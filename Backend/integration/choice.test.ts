import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import type { ChoiceService as ChoiceServiceType } from "../src/services/choice.service.ts";
import type { RoadRouter } from "../src/services/road-routing.ts";

const connection = process.env.CHOICE_TEST_DATABASE_URL;
if (!connection) throw new Error("CHOICE_TEST_DATABASE_URL must identify an owned local test database");
const parsed = new URL(connection);
if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !parsed.pathname.startsWith("/chalo_choice_")) {
  throw new Error("Refusing to run fixture cleanup outside an owned local chalo_choice_ database");
}
process.env.DATABASE_URL=connection;
process.env.DISABLE_MATCHING_LOOP="true";
const {ChoiceService}=await import("../src/services/choice.service.ts");
const db = new PrismaClient({ datasources: { db: { url: connection } } });
const point = (x: number): [number, number] => [28.63 - x * 0.001, 77.2177];
// Directed, predictable road timings for transaction tests. All coordinates sit
// exactly on the fixture corridor; provider behavior is tested independently.
const router: RoadRouter = {
  async matrix(points) {
    const metres = (a: [number, number], b: [number, number]) => Math.abs(a[0] - b[0]) * 100000;
    return { points, snappedPoints: points, distances: points.map(a => points.map(b => metres(a,b))),
      durations: points.map(a => points.map(b => metres(a,b) / 5)), fetchedAt: new Date().toISOString() };
  },
  async route(points) { return { points, snappedPoints: points, geometry: [point(0),point(100)], distanceMeters: 10000, durationSeconds: 2000, fetchedAt: new Date().toISOString() }; },
};
let service: ChoiceServiceType;
let passengerIds: string[];
let driverIds: string[];
let routeId: string;
const trip = { pickupLat: point(5)[0], pickupLng: point(5)[1], dropLat: point(50)[0], dropLng: point(50)[1] };

before(() => { service = new ChoiceService(db, router); });
beforeEach(async () => {
  // This DB is newly initialized under the guarded private test cluster above.
  await db.$executeRawUnsafe('TRUNCATE "ChoiceOffer", "Ride", "Vehicle", "Driver", "User", "RoutePoint", "Route" CASCADE');
  routeId = crypto.randomUUID();
  await db.route.create({data:{id:routeId,name:"Connaught Place to IGI Airport",startLat:point(0)[0],startLng:point(0)[1],endLat:point(100)[0],endLng:point(100)[1],roadGeometry:[point(0),point(100)]}});
  passengerIds=[];driverIds=[];
  for(let i=0;i<8;i++){
    const user=await db.user.create({data:{phone:`fixture-passenger-${i}`,name:`Passenger ${i}`,role:"Passenger"}});passengerIds.push(user.id);
  }
  for(let i=0;i<4;i++){
    const user=await db.user.create({data:{phone:`fixture-driver-${i}`,name:`Driver ${i}`,role:"Driver"}});
    const d=await db.driver.create({data:{userId:user.id,licenseNumber:`FIXTURE-${i}`,routeId,currentLocationLat:point(i)[0],currentLocationLng:point(i)[1],lastLocationAt:new Date(),capacity:4,isAvailable:true}});driverIds.push(d.id);
  }
});
after(async () => { await db.$disconnect();const {prisma}=await import('../src/lib/prisma.ts');await prisma.$disconnect(); });

async function choose(passengerId: string, index=0) {
  const listing=await service.options(passengerId,trip);
  assert.ok(listing.options[index]);
  return service.select(passengerId,listing.options[index]!.optionId);
}

test("listing has four server quotes, no hold, honest ratings and private cards",async()=>{
  const listing=await service.options(passengerIds[0]!,trip);
  assert.equal(listing.options.length,4);
  assert.equal(listing.options.filter(x=>x.recommended).length,1);
  assert.equal(listing.options[0]!.recommended,true);
  assert.equal(await db.ride.count(),0);
  assert.equal(await db.choiceOffer.count({where:{status:"Pending"}}),0);
  assert.equal(listing.options[0]!.driver.rating,null);
  assert.equal(listing.options[0]!.driver.previouslyRidden,false);
  assert.equal("passengers" in listing.options[0]!,false);
});

test("passenger can select a non-top driver; duplicate select is idempotent",async()=>{
  const listing=await service.options(passengerIds[0]!,trip);
  const option=listing.options[2]!;
  const selected=await service.select(passengerIds[0]!,option.optionId);
  assert.equal(selected.ride.driverId,option.driver.id);
  const duplicate=await service.select(passengerIds[0]!,option.optionId);
  assert.equal(duplicate.ride.id,selected.ride.id);
  assert.equal(await db.ride.count(),1);
  await assert.rejects(service.select(passengerIds[1]!,option.optionId));
});

test("last seat and one pending offer cannot be acquired concurrently",async()=>{
  await db.driver.updateMany({data:{capacity:1}});
  const a=await service.options(passengerIds[0]!,trip),b=await service.options(passengerIds[1]!,trip);
  const driver=a.options[0]!.driver.id;
  const bOption=b.options.find(o=>o.driver.id===driver)!;
  const settled=await Promise.allSettled([service.select(passengerIds[0]!,a.options[0]!.optionId),service.select(passengerIds[1]!,bOption.optionId)]);
  assert.equal(settled.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(await db.choiceOffer.count({where:{driverId:driver,status:"Pending"}}),1);
});

test("concurrent replay creates exactly one hold and one ride",async()=>{
  const listing=await service.options(passengerIds[0]!,trip);
  const results=await Promise.all([service.select(passengerIds[0]!,listing.options[0]!.optionId),service.select(passengerIds[0]!,listing.options[0]!.optionId)]);
  assert.equal(results[0].ride.id,results[1].ride.id);
  assert.equal(await db.ride.count(),1);
  assert.equal(await db.choiceOffer.count({where:{status:"Pending"}}),1);
});

test("one passenger cannot reserve two different drivers concurrently",async()=>{
  const listing=await service.options(passengerIds[0]!,trip);
  const results=await Promise.allSettled(listing.options.slice(0,2).map(o=>service.select(passengerIds[0]!,o.optionId)));
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(await db.ride.count({where:{passengerId:passengerIds[0]!,status:"Requested"}}),1);
});

test("version change while road estimates are in flight prevents selection",async()=>{
  const listing=await service.options(passengerIds[0]!,trip),option=listing.options[0]!;
  const racing=new ChoiceService(db,{route:router.route,matrix:async points=>{
    const matrix=await router.matrix(points);
    await db.driver.update({where:{id:option.driver.id},data:{locationVersion:{increment:1}}});
    return matrix;
  }});
  await assert.rejects(racing.select(passengerIds[0]!,option.optionId),/changed/i);
  assert.equal(await db.ride.count(),0);
});

test("location freshness is rechecked after routing, before the seat commit",async()=>{
  const listing=await service.options(passengerIds[0]!,trip),option=listing.options[0]!;
  await db.driver.update({where:{id:option.driver.id},data:{lastLocationAt:new Date(Date.now()-55000)}});
  const originalNow=Date.now;const initialNow=originalNow();
  const slow=new ChoiceService(db,{route:router.route,matrix:async points=>{
    const matrix=await router.matrix(points);
    Date.now=()=>initialNow+6000;
    return matrix;
  }});
  try{await assert.rejects(slow.select(passengerIds[0]!,option.optionId),/fresh/i);}
  finally{Date.now=originalNow;}
  assert.equal(await db.ride.count(),0);
});

test("expired hold is rejected and released; no automatic reassignment",async()=>{
  const selected=await choose(passengerIds[0]!);
  await db.choiceOffer.updateMany({where:{rideId:selected.ride.id},data:{expiresAt:new Date(Date.now()-1)}});
  await assert.rejects(service.accept(selected.ride.id,selected.ride.driverId!));
  await new ChoiceService(db,router).expire(); // A fresh process needs no in-memory timer.
  assert.equal((await db.ride.findUniqueOrThrow({where:{id:selected.ride.id}})).status,"Cancelled");
  assert.equal(await db.choiceOffer.count({where:{status:"Pending"}}),0);
});

test("pickup and drop-off obey canonical order, only unboarded rides can cancel",async()=>{
  const selected=await choose(passengerIds[0]!),did=selected.ride.driverId!;
  await service.accept(selected.ride.id,did);
  await assert.rejects(service.complete(selected.ride.id,did),/Pick up/i);
  await assert.rejects(service.pickup(selected.ride.id,driverIds.find(id=>id!==did)!),/assigned/i);
  await service.pickup(selected.ride.id,did);
  await assert.rejects(service.cancel(selected.ride.id,passengerIds[0]!),/onboard/i);
  await service.complete(selected.ride.id,did);
  await assert.rejects(service.complete(selected.ride.id,did));
});

test("successive acceptances charge the same durable delay budget without resetting it",async()=>{
  const first=await choose(passengerIds[0]!),did=first.ride.driverId!;
  await service.accept(first.ride.id,did);await service.pickup(first.ride.id,did);
  await db.ride.update({where:{id:first.ride.id},data:{addedDelaySeconds:90}});
  const listing=await service.options(passengerIds[1]!,trip),option=listing.options.find(o=>o.driver.id===did)!;
  const second=await service.select(passengerIds[1]!,option.optionId);await service.accept(second.ride.id,did);
  const charged=await db.ride.findUniqueOrThrow({where:{id:first.ride.id}});
  assert.equal(charged.addedDelaySeconds,120);
  await service.cancel(second.ride.id,passengerIds[1]!);
  assert.equal((await db.ride.findUniqueOrThrow({where:{id:first.ride.id}})).addedDelaySeconds,120);
  const nextTrip={...trip,pickupLat:point(8)[0]};
  const choices=await service.options(passengerIds[2]!,nextTrip),next=choices.options.find(o=>o.driver.id===did);
  if(next){const third=await service.select(passengerIds[2]!,next.optionId);await service.accept(third.ride.id,did);}
  assert.equal((await db.ride.findUniqueOrThrow({where:{id:first.ride.id}})).addedDelaySeconds,120);
});

test("ratings and familiarity require completed rides; quote expiry and raw snap guard hold",async()=>{
  await db.ride.create({data:{passengerId:passengerIds[0]!,driverId:driverIds[0]!,status:"Completed",pickupLat:trip.pickupLat,pickupLng:trip.pickupLng,rating:4}});
  const listing=await service.options(passengerIds[0]!,trip),familiar=listing.options.find(o=>o.driver.id===driverIds[0])!;
  assert.equal(familiar.driver.rating,4);assert.equal(familiar.driver.reviewCount,1);assert.equal(familiar.driver.previouslyRidden,true);
  await db.choiceOffer.update({where:{id:familiar.optionId},data:{expiresAt:new Date(0)}});
  await assert.rejects(service.select(passengerIds[0]!,familiar.optionId),/expired/i);
  const offRoad=new ChoiceService(db,{route:router.route,matrix:async points=>({...await router.matrix(points),snappedPoints:points.map(p=>[p[0]+.001,p[1]] as [number,number])})});
  await assert.rejects(offRoad.options(passengerIds[1]!,trip),/25 metres/i);
});

test("picked-up occupied auto remains eligible and accepted fare is immutable",async()=>{
  const first=await choose(passengerIds[0]!);const did=first.ride.driverId!;
  await service.accept(first.ride.id,did);
  const initial=await db.ride.findUniqueOrThrow({where:{id:first.ride.id}});
  await service.pickup(first.ride.id,did);
  const listing=await service.options(passengerIds[1]!,trip);
  const shared=listing.options.find(o=>o.driver.id===did);
  assert.ok(shared);assert.equal(shared.onboard,1);assert.equal(shared.shared,true);
  const selected=await service.select(passengerIds[1]!,shared.optionId);
  await service.accept(selected.ride.id,did);
  assert.equal((await db.ride.findUniqueOrThrow({where:{id:first.ride.id}})).lockedFare,initial.lockedFare);
  await service.cancel(selected.ride.id,passengerIds[1]!);
  const completed=await service.complete(first.ride.id,did);
  assert.equal(completed.ride.fare,initial.lockedFare);
});

test("legacy active trips, stale locations, unavailable and full autos are excluded",async()=>{
  await db.ride.create({data:{passengerId:passengerIds[5]!,driverId:driverIds[0]!,status:"Accepted",pickupLat:trip.pickupLat,pickupLng:trip.pickupLng,plannerMode:"Legacy"}});
  await db.driver.update({where:{id:driverIds[1]!},data:{lastLocationAt:new Date(0)}});
  await db.driver.update({where:{id:driverIds[2]!},data:{isAvailable:false}});
  await db.driver.update({where:{id:driverIds[3]!},data:{capacity:0}});
  assert.equal((await service.options(passengerIds[0]!,trip)).options.length,0);
});

test("legacy matcher cannot steal choice work or claim the driver during a choice reservation",async()=>{
  await db.driver.updateMany({where:{id:{not:driverIds[0]!}},data:{isAvailable:false}});
  const listing=await service.options(passengerIds[0]!,trip);
  const legacy=await db.ride.create({data:{passengerId:passengerIds[1]!,routeId,plannerMode:"Legacy",status:"Requested",pickupLat:trip.pickupLat,pickupLng:trip.pickupLng,dropLat:trip.dropLat,dropLng:trip.dropLng}});
  const {runMatching,stopMatchingLoop}=await import('../src/services/matching.service.ts');
  const results=await Promise.allSettled([service.select(passengerIds[0]!,listing.options[0]!.optionId),runMatching()]);
  const active=await db.ride.findMany({where:{driverId:driverIds[0]!,status:{in:["Requested","Accepted","PickedUp"]}}});
  assert.equal(active.length,1);
  assert.ok(results[0]!.status==="fulfilled"?active[0]!.plannerMode==="Choice":active[0]!.id===legacy.id);
  const choice=await db.ride.findFirst({where:{plannerMode:"Choice"}});
  if(choice){await service.accept(choice.id,driverIds[0]!);await service.pickup(choice.id,driverIds[0]!);await runMatching();assert.equal((await db.ride.findUniqueOrThrow({where:{id:legacy.id}})).driverId,null);}
  stopMatchingLoop();
});

test("a pending request is not accepted after location version changes during planning",async()=>{
  const selected=await choose(passengerIds[0]!);const did=selected.ride.driverId!;
  await db.driver.update({where:{id:did},data:{isAvailable:false,routeVersion:{increment:1}}});
  await assert.rejects(service.accept(selected.ride.id,did));
  assert.equal(await db.ride.count({where:{status:"Accepted"}}),0);
});

test("routing outage returns an unavailable error, never fabricated options",async()=>{
  const unavailable=new ChoiceService(db,{matrix:async()=>{throw new Error("routing unavailable")},route:router.route});
  await assert.rejects(unavailable.options(passengerIds[0]!,trip),/routing|unavailable/i);
  assert.equal(await db.choiceOffer.count(),0);
});

test("selection and acceptance keep a displayed feasible insertion instead of silently re-ranking it",async()=>{
  const did=driverIds[0]!;
  const existing=await db.ride.create({data:{passengerId:passengerIds[5]!,driverId:did,routeId,plannerMode:"Choice",status:"Accepted",pickupLat:point(5)[0],pickupLng:point(5)[1],dropLat:point(50)[0],dropLng:point(50)[1],lockedFare:100}});
  await db.driver.update({where:{id:did},data:{remainingStops:[{rideId:existing.id,type:"pickup",point:point(5)},{rideId:existing.id,type:"dropoff",point:point(50)}]}});
  const listing=await service.options(passengerIds[0]!,{...trip,pickupLat:point(10)[0],dropLat:point(51)[0]});
  const option=listing.options.find(o=>o.driver.id===did)!;assert.ok(option);
  const quote=await db.choiceOffer.findUniqueOrThrow({where:{id:option.optionId}});
  // A valid displayed proposal need not be the isolated driver's shortest one.
  const shown=[{rideId:existing.id,type:"pickup",point:point(5)},{rideId:"__new__",type:"pickup",point:point(10)},
    {rideId:"__new__",type:"dropoff",point:point(51)},{rideId:existing.id,type:"dropoff",point:point(50)}];
  await db.choiceOffer.update({where:{id:quote.id},data:{proposal:{...quote.proposal as object,stops:shown}}});
  const selected=await service.select(passengerIds[0]!,option.optionId);
  const expected=shown.map(s=>({...s,rideId:s.rideId==="__new__"?selected.ride.id:s.rideId}));
  const comparable=(value:unknown)=>JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==="number"?Number(item.toFixed(9)):item));
  const pending=await db.choiceOffer.findUniqueOrThrow({where:{id:quote.id}});
  assert.deepEqual(comparable((pending.proposal as {stops:unknown}).stops),comparable(expected));
  await service.accept(selected.ride.id,did);
  assert.deepEqual(comparable((await db.driver.findUniqueOrThrow({where:{id:did}})).remainingStops),comparable(expected));
});

test("pickup racing cancellation has exactly one winner",async()=>{
  const selected=await choose(passengerIds[0]!),did=selected.ride.driverId!;
  await service.accept(selected.ride.id,did);
  const results=await Promise.allSettled([service.pickup(selected.ride.id,did),service.cancel(selected.ride.id,passengerIds[0]!)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  const ride=await db.ride.findUniqueOrThrow({where:{id:selected.ride.id}});
  assert.ok(ride.status==="PickedUp"||ride.status==="Cancelled");
  assert.equal(ride.pickedUpAt!==null,ride.status==="PickedUp");
});

test("simultaneous drop-offs complete and free the seat only once",async()=>{
  const selected=await choose(passengerIds[0]!),did=selected.ride.driverId!;
  await service.accept(selected.ride.id,did);await service.pickup(selected.ride.id,did);
  const results=await Promise.allSettled([service.complete(selected.ride.id,did),service.complete(selected.ride.id,did)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  assert.equal((await db.ride.findUniqueOrThrow({where:{id:selected.ride.id}})).status,"Completed");
  assert.deepEqual((await db.driver.findUniqueOrThrow({where:{id:did}})).remainingStops,[]);
});

test("expiry during acceptance routing wins without committing partial acceptance",async()=>{
  const selected=await choose(passengerIds[0]!),did=selected.ride.driverId!;
  let entered!:()=>void,proceed!:()=>void;
  const planning=new Promise<void>(resolve=>{entered=resolve}),released=new Promise<void>(resolve=>{proceed=resolve});
  const slow=new ChoiceService(db,{route:router.route,matrix:async points=>{entered();await released;return router.matrix(points);}});
  const accepting=slow.accept(selected.ride.id,did);
  const outcome=accepting.then(value=>({value,error:null}),error=>({value:null,error}));
  await planning;
  await db.choiceOffer.updateMany({where:{rideId:selected.ride.id},data:{expiresAt:new Date(0)}});
  try{await service.expire();}finally{proceed();}
  assert.ok((await outcome).error);
  assert.equal((await db.ride.findUniqueOrThrow({where:{id:selected.ride.id}})).status,"Cancelled");
  assert.equal(await db.choiceOffer.count({where:{status:"Pending"}}),0);
  assert.deepEqual((await db.driver.findUniqueOrThrow({where:{id:did}})).remainingStops,[]);
});
