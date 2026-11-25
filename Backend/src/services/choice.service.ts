import crypto from "node:crypto";
import { Prisma, type PrismaClient, type ChoiceOffer, type Ride } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import { emitToUser, getIo } from "../lib/socket.ts";
import { calculateFare } from "../lib/fare.ts";
import { distance, snapToPolyline, type Point } from "../algorithms/geo.ts";
import { evaluateDriverPlan, rankDriverOptions, type ChoicePassenger, type ChoiceStop, type DriverPlanSet, type InsertionPlan } from "../algorithms/choicePlanner.ts";
import { roadRouter, type RoadRouter } from "./road-routing.ts";

export class ChoiceError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "ChoiceError"; }
}
const ACTIVE = ["Requested", "Accepted", "PickedUp"] as const;
const CONFIRMED = ["Accepted", "PickedUp"] as const;
const HOLD_MS = 30_000;
const LOCATION_MAX_AGE_MS = 60_000;
const NEW_ID = "__new__";
const asJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
const driverInclude = { user: { select: { name: true, phone: true } }, vehicle: true,
  rides: { where: { status: { in: [...ACTIVE] } } } } satisfies Prisma.DriverInclude;
type DriverState = Prisma.DriverGetPayload<{ include: typeof driverInclude }>;
type Tx = Prisma.TransactionClient;
type Trip = { rawPickup: Point; rawDrop: Point; pickup: Point; drop: Point; routeId: string; routeName: string; estimateAt: string };
type Prepared = { driver: DriverState; set: DriverPlanSet; estimateAt: string };
const fail = (message: string): never => { throw new ChoiceError(409, message); };
function stops(value: unknown): ChoiceStop[] {
  if (!Array.isArray(value)) return fail("Driver route state is unavailable");
  return value as ChoiceStop[];
}
function inputPoint(lat: unknown, lng: unknown): Point {
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ChoiceError(400, "Choose valid latitude/longitude coordinates");
  }
  return [lat, lng];
}
function participant(r: Ride & { driver?: { userId: string } | null }, userId: string) {
  if (r.passengerId !== userId && r.driver?.userId !== userId) throw new ChoiceError(403, "Not allowed to change this ride");
}

/** Durable choice booking. Network routing happens before short locked commits. */
export class ChoiceService {
  constructor(private readonly db: PrismaClient, private readonly router: RoadRouter) {}

  private async road<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch { throw new ChoiceError(503, "Road estimates are temporarily unavailable. Please try again."); }
  }

  private async lockDriver(tx: Tx, driverId: string) {
    await tx.$queryRaw`SELECT "id" FROM "Driver" WHERE "id" = ${driverId} FOR UPDATE`;
  }
  private invalidate(driverId: string) { getIo()?.emit("driverOptionsChanged", { driverId }); }

  async expire() {
    const expired = await this.db.choiceOffer.findMany({ where: { status: "Pending", expiresAt: { lte: new Date() } }, select: { id: true, driverId: true } });
    for (const offer of expired) await this.release(offer.id, offer.driverId, "Expired", "Driver did not respond in time");
  }

  private async trip(body: { pickupLat: unknown; pickupLng: unknown; dropLat: unknown; dropLng: unknown }): Promise<Trip> {
    const rawPickup = inputPoint(body.pickupLat, body.pickupLng), rawDrop = inputPoint(body.dropLat, body.dropLng);
    const route = await this.db.route.findFirst({ where: { name: process.env.CHOICE_ROUTE_NAME || "Connaught Place to IGI Airport" } });
    if (!route) return fail("The demonstration route is not configured");
    let geometry: Point[];
    if (route.roadGeometry && Array.isArray(route.roadGeometry)) geometry = route.roadGeometry as unknown as Point[];
    else {
      const routed = await this.road(() => this.router.route([[route.startLat, route.startLng], [route.endLat, route.endLng]]));
      geometry = routed.geometry;
      await this.db.route.update({ where: { id: route.id }, data: { roadGeometry: asJson(geometry), roadGeometryAt: new Date(routed.fetchedAt) } });
    }
    const matrix = await this.road(() => this.router.matrix([rawPickup, rawDrop]));
    const pickup = matrix.snappedPoints[0], drop = matrix.snappedPoints[1];
    if (!pickup || !drop || distance(rawPickup, pickup) > .025 || distance(rawDrop, drop) > .025) {
      throw new ChoiceError(400, "Choose pickup and drop-off points on a road (within 25 metres)");
    }
    if ((matrix.distances[0]?.[1] ?? 0) < 300) throw new ChoiceError(400, "Pickup and drop-off must be at least 300 road metres apart");
    if (!snapToPolyline(pickup, geometry) || snapToPolyline(pickup, geometry)!.km > 1 || !snapToPolyline(drop, geometry) || snapToPolyline(drop, geometry)!.km > 1) {
      throw new ChoiceError(400, "Both points must be within the demonstration road corridor");
    }
    return { rawPickup, rawDrop, pickup, drop, routeId: route.id, routeName: route.name, estimateAt: matrix.fetchedAt };
  }

  private async prepare(driver: DriverState, trip: Trip, ownOfferId?: string): Promise<Prepared | null> {
    if (!driver.isAvailable || driver.routeId !== trip.routeId || !driver.lastLocationAt || Date.now() - driver.lastLocationAt.getTime() > LOCATION_MAX_AGE_MS) return null;
    if (driver.rides.some(r => r.plannerMode === "Legacy")) return null;
    const confirmed = driver.rides.filter(r => r.plannerMode === "Choice" && CONFIRMED.includes(r.status as typeof CONFIRMED[number]));
    if (confirmed.length >= driver.capacity || driver.capacity <= 0) return null;
    const pending = await this.db.choiceOffer.findFirst({ where: { driverId: driver.id, status: "Pending", ...(ownOfferId ? { id: { not: ownOfferId } } : {}) } });
    if (pending) return null;
    const remaining = stops(driver.remainingStops);
    const passengers: ChoicePassenger[] = confirmed.map(r => ({ id: r.id, pickup: [r.pickupLat, r.pickupLng],
      destination: [r.dropLat!, r.dropLng!], onboard: r.status === "PickedUp", addedDelaySeconds: r.addedDelaySeconds }));
    const location: Point = [driver.currentLocationLat, driver.currentLocationLng];
    const points: Point[] = [location, ...remaining.map(s => s.point), ...passengers.flatMap(p => p.onboard ? [p.destination] : [p.pickup, p.destination]), trip.pickup, trip.drop];
    const matrix = await this.road(() => this.router.matrix(points));
    if (!matrix.snappedPoints[0] || distance(location, matrix.snappedPoints[0]) > .025) return null;
    try {
      const set = evaluateDriverPlan({ driverId: driver.id, location, capacity: driver.capacity, passengers, stops: remaining, matrix },
        { id: NEW_ID, pickup: trip.pickup, destination: trip.drop, onboard: false, addedDelaySeconds: 0 },
        { maxAddedSeconds: 120, maxInitialDetourRatio: .5, dwellSeconds: 30 });
      return { driver, set, estimateAt: matrix.fetchedAt };
    } catch (e) {
      if (e instanceof TypeError) return null;
      throw e;
    }
  }

  async options(passengerId: string, body: { pickupLat: unknown; pickupLng: unknown; dropLat: unknown; dropLng: unknown }) {
    await this.expire();
    const trip = await this.trip(body);
    const drivers = await this.db.driver.findMany({ where: { routeId: trip.routeId, isAvailable: true, lastLocationAt: { gte: new Date(Date.now() - LOCATION_MAX_AGE_MS) } }, include: driverInclude });
    const scan = drivers.filter(d => !d.rides.some(r => r.plannerMode === "Legacy") && d.rides.filter(r => CONFIRMED.includes(r.status as typeof CONFIRMED[number])).length < d.capacity)
      .sort((a,b) => distance([a.currentLocationLat,a.currentLocationLng],trip.pickup) - distance([b.currentLocationLat,b.currentLocationLng],trip.pickup) || a.id.localeCompare(b.id)).slice(0,8);
    const prepared = (await Promise.all(scan.map(d => this.prepare(d, trip)))).filter((x): x is Prepared => x !== null);
    const ranked = rankDriverOptions(prepared.map(p => p.set),4);
    const ids = ranked.map(r => r.driverId), now = new Date(), expiresAt = new Date(now.getTime()+HOLD_MS);
    const [ratings, familiar] = ids.length ? await Promise.all([
      this.db.ride.groupBy({ by: ["driverId"], where: { driverId: { in: ids }, status: "Completed", rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
      this.db.ride.findMany({ where: { passengerId, driverId: { in: ids }, status: "Completed" }, select: { driverId: true }, distinct: ["driverId"] }),
    ]) : [[],[]];
    const options = await Promise.all(ranked.map(async plan => {
      const preparation = prepared.find(p=>p.driver.id===plan.driverId)!;
      const snapshot = preparation.driver;
      const km = Math.round(plan.directDistanceMeters / 10) / 100;
      const fare = calculateFare(km,plan.shared?2:1).fare;
      const offer = await this.db.choiceOffer.create({ data: { passengerId,driverId:snapshot.id,routeId:trip.routeId,
        routeVersion:snapshot.routeVersion,locationVersion:snapshot.locationVersion,trip:asJson(trip),proposal:asJson(plan),
        quoteFare:fare,quoteDistanceKm:km,quoteShared:plan.shared,expiresAt } });
      const rated = ratings.find(r=>r.driverId===snapshot.id);
      const onboard = snapshot.rides.filter(r=>r.plannerMode==="Choice"&&r.status==="PickedUp").length;
      const reserved = snapshot.rides.filter(r=>r.plannerMode==="Choice"&&r.status==="Accepted").length;
      return { optionId:offer.id, driver:{ id:snapshot.id,name:snapshot.user.name || "Driver",licenseNumber:snapshot.licenseNumber,
        vehicle:snapshot.vehicle?`${snapshot.vehicle.make} ${snapshot.vehicle.model}`:null,
        rating:rated?Math.round((rated._avg.rating??0)*10)/10:null,reviewCount:rated?._count.rating??0,
        previouslyRidden:familiar.some(r=>r.driverId===snapshot.id) },
        pickupEtaSeconds:Math.ceil(plan.pickupEtaSeconds),onboard,reserved,capacity:snapshot.capacity,availableSeats:snapshot.capacity-onboard-reserved,
        fare,shared:plan.shared,recommended:plan.recommended,
        reason:plan.recommended?"Lowest System-Aware score among these feasible options":"Fits the route, capacity and delay limits",
        expiresAt:expiresAt.toISOString(),estimateAt:preparation.estimateAt };
    }));
    return { options,pickup:trip.pickup,drop:trip.drop,routeName:trip.routeName,serverTime:now.toISOString(),
      attribution:{text:"© OpenStreetMap contributors · Routing: OSRM",mapUrl:"https://www.openstreetmap.org/copyright",routingUrl:"https://project-osrm.org/"} };
  }

  private async preparedOffer(offer: ChoiceOffer): Promise<{ driver: DriverState; plan: InsertionPlan }> {
    const driver = await this.db.driver.findUnique({ where:{id:offer.driverId},include:driverInclude });
    if (!driver) return fail("Driver is no longer available");
    const prepared = await this.prepare(driver,offer.trip as unknown as Trip,offer.id);
    if (!prepared) return fail("This driver is no longer available. Refresh the choices.");
    // Revalidate the displayed ordering rather than renormalizing the fleet's
    // winner against this driver alone. Remove only already-visited old stops.
    const previous = offer.proposal as unknown as InsertionPlan | null;
    const remaining = new Set(stops(driver.remainingStops).map(s=>`${s.rideId}:${s.type}`));
    const proposed = previous?.stops.filter(s=>s.rideId===NEW_ID||s.rideId===offer.rideId||remaining.has(`${s.rideId}:${s.type}`))
      .map(s=>({...s,rideId:s.rideId===offer.rideId?NEW_ID:s.rideId}));
    const plan = prepared.set.insertions.find(candidate=>proposed?.length===candidate.stops.length&&candidate.stops.every((s,i)=>{
      const old=proposed[i]!;return s.rideId===old.rideId&&s.type===old.type&&s.point[0]===old.point[0]&&s.point[1]===old.point[1];
    }));
    if (!plan) return fail("This trip no longer fits the driver's route and delay limits");
    return { driver,plan };
  }

  private assertVersion(current: { routeVersion:number;locationVersion:number;lastLocationAt:Date|null }|null,snapshot: DriverState) {
    if (!current) return fail("Driver is no longer available");
    if (current.routeVersion!==snapshot.routeVersion || current.locationVersion!==snapshot.locationVersion) fail("Driver location or route changed. Refresh and try again.");
    if (!current.lastLocationAt || Date.now()-current.lastLocationAt.getTime()>LOCATION_MAX_AGE_MS) fail("Driver location is no longer fresh. Refresh and try again.");
  }

  async select(passengerId: string, optionId: string) {
    await this.expire();
    const offer = await this.db.choiceOffer.findUnique({where:{id:optionId}});
    if (!offer || offer.passengerId!==passengerId) throw new ChoiceError(403,"This option does not belong to you");
    if ((offer.status==="Pending"||offer.status==="Accepted")&&offer.rideId) {
      return {ride:await this.decorate(await this.db.ride.findUniqueOrThrow({where:{id:offer.rideId}})),expiresAt:offer.expiresAt.toISOString(),serverTime:new Date().toISOString()};
    }
    if (offer.status!=="Quoted"||offer.expiresAt.getTime()<=Date.now()) return fail("This option expired. Refresh the choices.");
    const prepared = await this.preparedOffer(offer);
    const trip=offer.trip as unknown as Trip;
    const result=await this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${passengerId} FOR UPDATE`;
      await this.lockDriver(tx,offer.driverId);
      const currentOffer=await tx.choiceOffer.findUniqueOrThrow({where:{id:offer.id}});
      if ((currentOffer.status==="Pending"||currentOffer.status==="Accepted")&&currentOffer.rideId) {
        return {ride:await tx.ride.findUniqueOrThrow({where:{id:currentOffer.rideId}}),expiresAt:currentOffer.expiresAt,
          plan:currentOffer.proposal as unknown as InsertionPlan,replayed:true};
      }
      if(currentOffer.status!=="Quoted"||currentOffer.expiresAt.getTime()<=Date.now()) return fail("This option expired or was already selected");
      const current=await tx.driver.findUnique({where:{id:offer.driverId}});this.assertVersion(current,prepared.driver);
      if(!current!.isAvailable) return fail("Driver is no longer accepting passengers");
      if(await tx.ride.findFirst({where:{passengerId,status:{in:[...ACTIVE]}}})) return fail("You already have an active ride");
      if(await tx.choiceOffer.findFirst({where:{driverId:offer.driverId,status:"Pending"}})) return fail("This driver is considering another request");
      const occupied=await tx.ride.findMany({where:{driverId:offer.driverId,status:{in:[...ACTIVE]}}});
      if(occupied.some(r=>r.plannerMode==="Legacy")||occupied.length>=current!.capacity) return fail("No seat is available");
      const existingPool=occupied.find(r=>r.poolId)?.poolId??crypto.randomUUID();
      const ride=await tx.ride.create({data:{passengerId,driverId:offer.driverId,routeId:offer.routeId,plannerMode:"Choice",poolId:existingPool,
        pickupLat:trip.pickup[0],pickupLng:trip.pickup[1],dropLat:trip.drop[0],dropLng:trip.drop[1],
        rawPickupLat:trip.rawPickup[0],rawPickupLng:trip.rawPickup[1],rawDropLat:trip.rawDrop[0],rawDropLng:trip.rawDrop[1],
        fare:offer.quoteFare,distanceKm:offer.quoteDistanceKm,quoteShared:offer.quoteShared,status:"Requested",matchedAt:new Date()}});
      const expiresAt=new Date(Date.now()+HOLD_MS);
      const plan={...prepared.plan,stops:prepared.plan.stops.map(s=>({...s,rideId:s.rideId===NEW_ID?ride.id:s.rideId}))};
      await tx.choiceOffer.update({where:{id:offer.id},data:{status:"Pending",rideId:ride.id,proposal:asJson(plan),expiresAt,
        routeVersion:current!.routeVersion+1,locationVersion:current!.locationVersion}});
      await tx.driver.update({where:{id:offer.driverId},data:{routeVersion:{increment:1}}});
      return {ride,expiresAt,plan,replayed:false};
    });
    const decorated=await this.decorate(result.ride);
    if (result.replayed) return {ride:decorated,expiresAt:result.expiresAt.toISOString(),serverTime:new Date().toISOString()};
    const driver=prepared.driver;
    const driverRide=await this.decorate(result.ride,true);
    emitToUser(driver.id,"newRideRequest",{poolId:result.ride.poolId,mode:"Choice",expiresAt:result.expiresAt.toISOString(),serverTime:new Date().toISOString(),
      routeDistanceKm:result.plan.routeDistanceMeters/1000,stops:driverRide.plannedStops,rides:[{rideId:result.ride.id,passengerId,
        passengerName:(await this.db.user.findUnique({where:{id:passengerId}}))?.name??"Passenger",pickupLat:trip.pickup[0],pickupLng:trip.pickup[1],dropLat:trip.drop[0],dropLng:trip.drop[1],
        pickupSequence:null,dropSequence:null,fare:offer.quoteFare,distanceKm:offer.quoteDistanceKm}]});
    emitToUser(passengerId,"rideMatched",{rideId:result.ride.id,fare:offer.quoteFare,pooled:offer.quoteShared,expiresAt:result.expiresAt.toISOString(),driver:this.driverPayload(driver)});
    this.invalidate(driver.id);
    return {ride:decorated,expiresAt:result.expiresAt.toISOString(),serverTime:new Date().toISOString()};
  }

  private driverPayload(driver: DriverState) {
    return {id:driver.id,name:driver.user.name,phone:driver.user.phone,licenseNumber:driver.licenseNumber,
      vehicle:driver.vehicle?`${driver.vehicle.make} ${driver.vehicle.model}`:null,lat:driver.currentLocationLat,lng:driver.currentLocationLng};
  }

  async accept(rideId:string,driverId:string) {
    await this.expire();
    const offer=await this.db.choiceOffer.findUnique({where:{rideId}});
    if(!offer||offer.driverId!==driverId) throw new ChoiceError(403,"Ride not offered to you");
    if(offer.status!=="Pending"||offer.expiresAt.getTime()<=Date.now()) return fail("This offer is no longer pending");
    const prepared=await this.preparedOffer(offer);
    const plan={...prepared.plan,stops:prepared.plan.stops.map(s=>({...s,rideId:s.rideId===NEW_ID?rideId:s.rideId}))};
    const ride=await this.db.$transaction(async tx=>{
      await this.lockDriver(tx,driverId);
      const current=await tx.driver.findUnique({where:{id:driverId}});this.assertVersion(current,prepared.driver);
      const latest=await tx.choiceOffer.findUniqueOrThrow({where:{id:offer.id}});
      if(latest.status!=="Pending"||latest.expiresAt.getTime()<=Date.now()) return fail("Offer expired or changed");
      if(!current!.isAvailable) return fail("Driver is not accepting more passengers");
      const active=await tx.ride.findMany({where:{driverId,status:{in:[...ACTIVE]}}});
      if(active.some(r=>r.plannerMode==="Legacy")||active.length>current!.capacity) return fail("Vehicle capacity changed");
      for(const [id,increment] of Object.entries(plan.delayIncrements)){
        if(id===NEW_ID)continue;
        const charged=await tx.ride.updateMany({where:{id,driverId,plannerMode:"Choice",status:{in:[...CONFIRMED]},addedDelaySeconds:{lte:120-increment}},data:{addedDelaySeconds:{increment}}});
        if(charged.count!==1) return fail("An existing passenger's route or delay budget changed");
      }
      const accepted=await tx.ride.updateMany({where:{id:rideId,driverId,plannerMode:"Choice",status:"Requested"},
        data:{status:"Accepted",acceptedAt:new Date(),lockedFare:offer.quoteFare,fare:offer.quoteFare}});
      if(accepted.count!==1)return fail("Ride no longer pending");
      await tx.driver.update({where:{id:driverId},data:{remainingStops:asJson(plan.stops),routeVersion:{increment:1}}});
      await tx.choiceOffer.update({where:{id:offer.id},data:{status:"Accepted",proposal:asJson(plan)}});
      return tx.ride.findUniqueOrThrow({where:{id:rideId}});
    });
    emitToUser(ride.passengerId,"rideAccepted",{rideId,fare:ride.lockedFare,pooled:ride.quoteShared,driver:this.driverPayload(prepared.driver)});
    this.invalidate(driverId);
    return {...await this.decorate(ride),pool:[await this.decorate(ride)]};
  }

  private async release(offerId:string,driverId:string,state:"Declined"|"Expired"|"Cancelled",reason:string) {
    const result=await this.db.$transaction(async tx=>{
      await this.lockDriver(tx,driverId);
      const offer=await tx.choiceOffer.findUnique({where:{id:offerId}});
      if(!offer||offer.driverId!==driverId||offer.status!=="Pending")return null;
      if(state==="Expired"&&offer.expiresAt.getTime()>Date.now())return null;
      await tx.choiceOffer.update({where:{id:offer.id},data:{status:state}});
      if(offer.rideId)await tx.ride.updateMany({where:{id:offer.rideId,status:"Requested",plannerMode:"Choice"},data:{status:"Cancelled"}});
      await tx.driver.update({where:{id:driverId},data:{routeVersion:{increment:1}}});
      return offer;
    });
    if(result){
      emitToUser(result.passengerId,"rideUnmatched",{rideId:result.rideId,reason,returnToChoices:true});
      emitToUser(driverId,"requestExpired",{poolId:result.rideId,rideId:result.rideId});this.invalidate(driverId);
    }
    return result;
  }

  async decline(rideId:string,driverId:string) {
    const offer=await this.db.choiceOffer.findUnique({where:{rideId}});
    if(!offer||offer.driverId!==driverId)throw new ChoiceError(403,"Ride not offered to you");
    if(!await this.release(offer.id,driverId,"Declined","Driver declined your request"))return fail("Offer no longer pending");
    return {message:"Ride declined"};
  }

  private async progress(rideId:string,driverId:string,type:"pickup"|"dropoff") {
    const ride=await this.db.$transaction(async tx=>{
      await this.lockDriver(tx,driverId);
      const [driver,current]=await Promise.all([tx.driver.findUniqueOrThrow({where:{id:driverId}}),tx.ride.findUnique({where:{id:rideId}})]);
      if(!current||current.driverId!==driverId||current.plannerMode!=="Choice")throw new ChoiceError(403,"Ride not assigned to you");
      const expected=type==="pickup"?"Accepted":"PickedUp";
      if(current.status!==expected)return fail(type==="pickup"?"Ride is not awaiting pickup":"Pick up this passenger before completing the ride");
      const plan=stops(driver.remainingStops),next=plan[0];
      if(!next||next.rideId!==rideId||next.type!==type)return fail("Visit the next planned stop first");
      await tx.driver.update({where:{id:driverId},data:{remainingStops:asJson(plan.slice(1)),routeVersion:{increment:1}}});
      return tx.ride.update({where:{id:rideId},data:type==="pickup"?{status:"PickedUp",pickedUpAt:new Date()}:
        {status:"Completed",completedAt:new Date(),fare:current.lockedFare??current.fare}});
    });
    if(type==="pickup"){
      emitToUser(ride.passengerId,"ridePickedUp",{rideId});emitToUser(driverId,"ridePickedUp",{rideId});
    }else{
      const driver=await this.db.driver.findUniqueOrThrow({where:{id:driverId},include:{user:true}});
      const payload={rideId,fare:ride.lockedFare,distanceKm:ride.distanceKm,pooled:ride.quoteShared,driver:{id:driverId,name:driver.user.name}};
      emitToUser(ride.passengerId,"rideCompleted",payload);emitToUser(driverId,"rideCompleted",payload);
    }
    this.invalidate(driverId);return this.decorate(ride);
  }
  async pickup(rideId:string,driverId:string){return{ride:await this.progress(rideId,driverId,"pickup")};}
  async complete(rideId:string,driverId:string){return{message:"Ride completed successfully",ride:await this.progress(rideId,driverId,"dropoff")};}

  async cancel(rideId:string,userId:string) {
    const current=await this.db.ride.findUnique({where:{id:rideId},include:{driver:{select:{userId:true}}}});
    if(!current||current.plannerMode!=="Choice"||!current.driverId)return fail("Ride not found");participant(current,userId);
    if(current.status==="Requested"){
      const offer=await this.db.choiceOffer.findUnique({where:{rideId}});
      if(!offer||!await this.release(offer.id,current.driverId,"Cancelled","Request cancelled"))return fail("Ride changed");
      return {message:"Ride cancelled successfully"};
    }
    await this.db.$transaction(async tx=>{
      await this.lockDriver(tx,current.driverId!);
      const latest=await tx.ride.findUniqueOrThrow({where:{id:rideId}});
      if(latest.status!=="Accepted")return fail("Only an unboarded ride can be cancelled; an onboard ride must be dropped off");
      const driver=await tx.driver.findUniqueOrThrow({where:{id:current.driverId!}});
      await tx.ride.update({where:{id:rideId},data:{status:"Cancelled"}});
      await tx.driver.update({where:{id:driver.id},data:{remainingStops:asJson(stops(driver.remainingStops).filter(s=>s.rideId!==rideId)),routeVersion:{increment:1}}});
    });
    const payload={rideId,cancelledBy:current.passengerId===userId?"passenger":"driver"};
    emitToUser(current.passengerId,"rideCancelled",payload);emitToUser(current.driverId,"rideCancelled",payload);this.invalidate(current.driverId);
    return {message:"Ride cancelled successfully"};
  }

  async decorate<T extends Ride>(ride:T,driverView=false) {
    if(ride.plannerMode!=="Choice")return {...ride,offerExpiresAt:null,plannedStops:[]};
    const [driver,offer]=await Promise.all([ride.driverId?this.db.driver.findUnique({where:{id:ride.driverId}}):null,this.db.choiceOffer.findUnique({where:{rideId:ride.id}})]);
    const plan=ride.status==="Requested"&&offer?.proposal?(offer.proposal as unknown as InsertionPlan).stops:stops(driver?.remainingStops??[]);
    const ids=[...new Set(plan.map(s=>s.rideId))];
    const names=driverView&&ids.length?await this.db.ride.findMany({where:{id:{in:ids}},select:{id:true,passenger:{select:{name:true}}}}):[];
    return {...ride,offerExpiresAt:offer?.status==="Pending"?offer.expiresAt.toISOString():null,
      plannedStops:plan.map(s=>({rideId:s.rideId,type:s.type,lat:s.point[0],lng:s.point[1],passengerName:names.find(r=>r.id===s.rideId)?.passenger.name??"Passenger"}))};
  }
}

export const choiceService = new ChoiceService(prisma,roadRouter);
