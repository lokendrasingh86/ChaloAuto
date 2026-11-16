import { prisma } from "../lib/prisma.ts";
import { emitToUser } from "../lib/socket.ts";
import { distance } from "../algorithms/geo.ts";
import { calculateFare, tripDistanceKm } from "../lib/fare.ts";
import { findRouteForTrip } from "./route.service.ts";
import { markDeclined, releasePool, scheduleMatching } from "./matching.service.ts";

const driverCard = {
  select: {
    id: true,
    licenseNumber: true,
    currentLocationLat: true,
    currentLocationLng: true,
    user: { select: { name: true, phone: true } },
    vehicle: true,
  },
} as const;

/** Passenger asks for a ride. The request waits in the batch until the System-Aware matcher assigns a driver. */
export const requestRide = async (
  passengerId: string,
  pickupLat: number,
  pickupLng: number,
  dropLat?: number | null,
  dropLng?: number | null,
) => {
  if (![pickupLat, pickupLng].every((n) => typeof n === "number" && Number.isFinite(n))) {
    throw new Error("Invalid coordinates");
  }
  if ((dropLat == null) !== (dropLng == null)) {
    throw new Error("Both dropLat and dropLng are required");
  }

  const existing = await prisma.ride.findFirst({
    where: { passengerId, status: { in: ["Requested", "Accepted"] } },
  });
  if (existing) {
    throw new Error("You already have an active ride");
  }

  const trip = await findRouteForTrip(pickupLat, pickupLng, dropLat, dropLng);
  const km = tripDistanceKm(trip.pickup, trip.drop);
  const quote = calculateFare(km, 1);

  const ride = await prisma.ride.create({
    data: {
      passengerId,
      routeId: trip.routeId,
      pickupLat: trip.pickup[0],
      pickupLng: trip.pickup[1],
      dropLat: trip.drop[0],
      dropLng: trip.drop[1],
      distanceKm: quote.distanceKm,
      fare: quote.fare,
      status: "Requested",
    },
  });

  scheduleMatching();
  return { ...ride, routeName: trip.routeName };
};

/** Driver accepts the offered pool; every ride in the pool becomes Accepted. */
export const acceptRide = async (rideId: string, driverId: string) => {
  const ride = await prisma.ride.findFirst({ where: { id: rideId, status: "Requested", driverId } });
  if (!ride) {
    throw new Error("Ride not found or not offered to you");
  }

  const poolRides = await prisma.ride.findMany({
    where: ride.poolId ? { poolId: ride.poolId, driverId, status: "Requested" } : { id: ride.id },
    select: { id: true },
  });
  const ids = poolRides.map((r) => r.id);

  await prisma.ride.updateMany({
    where: { id: { in: ids } },
    data: { status: "Accepted", acceptedAt: new Date() },
  });

  const rides = await prisma.ride.findMany({
    where: { id: { in: ids } },
    include: { driver: driverCard, passenger: { select: { name: true, phone: true } } },
    orderBy: { pickupSequence: "asc" },
  });

  for (const r of rides) {
    const d = r.driver!;
    emitToUser(r.passengerId, "rideAccepted", {
      rideId: r.id,
      fare: r.fare,
      pooled: rides.length > 1,
      pickupSequence: r.pickupSequence,
      driver: {
        id: d.id,
        name: d.user.name,
        phone: d.user.phone,
        licenseNumber: d.licenseNumber,
        vehicle: d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}` : null,
        lat: d.currentLocationLat,
        lng: d.currentLocationLng,
        distanceKm: distance([r.pickupLat, r.pickupLng], [d.currentLocationLat, d.currentLocationLng]).toFixed(2),
      },
    });
  }

  const mine = rides.find((r) => r.id === rideId) ?? rides[0]!;
  return { ...mine, pool: rides };
};

/** Driver rejects an offered pool: it returns to the waiting batch and will not be offered to this driver again. */
export const declineRide = async (rideId: string, driverId: string) => {
  const ride = await prisma.ride.findFirst({ where: { id: rideId, status: "Requested", driverId } });
  if (!ride) {
    throw new Error("Ride not found or not offered to you");
  }
  if (ride.poolId) {
    await releasePool(ride.poolId, driverId, "Driver declined");
  } else {
    await prisma.ride.update({ where: { id: ride.id }, data: { driverId: null } });
    markDeclined(ride.id, driverId);
  }
  scheduleMatching(500);
  return { message: "Ride declined" };
};

/** Marks a single ride in the pool as completed (drop-off done). */
export const completeRide = async (rideId: string, driverId: string) => {
  const ride = await prisma.ride.findFirst({
    where: { id: rideId, driverId, status: "Accepted" },
    include: { driver: driverCard },
  });
  if (!ride) {
    throw new Error("Ride not found or not in progress");
  }

  const poolSize = ride.poolId
    ? await prisma.ride.count({ where: { poolId: ride.poolId, status: { in: ["Accepted", "Completed"] } } })
    : 1;
  const km =
    ride.dropLat != null && ride.dropLng != null
      ? tripDistanceKm([ride.pickupLat, ride.pickupLng], [ride.dropLat, ride.dropLng])
      : (ride.distanceKm ?? 0);
  const { fare } = calculateFare(km, poolSize);

  const done = await prisma.ride.update({
    where: { id: rideId },
    data: { status: "Completed", completedAt: new Date(), distanceKm: km, fare },
  });

  const payload = {
    rideId,
    fare,
    distanceKm: km,
    pooled: poolSize > 1,
    driver: { id: ride.driver!.id, name: ride.driver!.user.name },
  };
  emitToUser(ride.passengerId, "rideCompleted", payload);
  emitToUser(driverId, "rideCompleted", payload);
  return { message: "Ride completed successfully", ride: done };
};

/** Passenger or driver cancels a ride that is not completed yet. */
export const cancelRide = async (rideId: string, userId: string) => {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    include: { driver: { select: { id: true, userId: true } } },
  });
  if (!ride) {
    throw new Error("Ride not found");
  }
  const isPassenger = ride.passengerId === userId;
  const isDriver = ride.driver?.userId === userId;
  if (!isPassenger && !isDriver) {
    throw new Error("Not allowed to cancel this ride");
  }
  if (ride.status === "Completed" || ride.status === "Cancelled") {
    throw new Error(`Ride is already ${ride.status.toLowerCase()}`);
  }

  await prisma.ride.update({ where: { id: rideId }, data: { status: "Cancelled" } });

  const payload = { rideId, cancelledBy: isDriver ? "driver" : "passenger" };
  emitToUser(ride.passengerId, "rideCancelled", payload);
  if (ride.driverId) emitToUser(ride.driverId, "rideCancelled", payload);
  scheduleMatching(500);
  return { message: "Ride cancelled successfully" };
};

export const rateRide = async (rideId: string, passengerId: string, rating: number, comment?: string) => {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be a whole number from 1 to 5");
  }
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride || ride.passengerId !== passengerId) {
    throw new Error("Ride not found");
  }
  if (ride.status !== "Completed") {
    throw new Error("Only completed rides can be rated");
  }
  if (ride.rating != null) {
    throw new Error("This ride is already rated");
  }
  return prisma.ride.update({
    where: { id: rideId },
    data: { rating, ratingComment: comment?.slice(0, 500) ?? null },
  });
};

export const updateDriverLocation = async (driverId: string, lat: number, lng: number) => {
  if (![lat, lng].every((n) => typeof n === "number" && Number.isFinite(n))) {
    throw new Error("Invalid coordinates");
  }
  const driver = await prisma.driver.update({
    where: { id: driverId },
    data: { currentLocationLat: lat, currentLocationLng: lng },
  });

  const rides = await prisma.ride.findMany({
    where: { driverId, status: "Accepted" },
    select: { id: true, passengerId: true },
  });
  for (const r of rides) {
    emitToUser(r.passengerId, "driverLocationUpdate", { rideId: r.id, driverId, lat, lng });
  }
  return driver;
};

export const getRideStatus = async (rideId: string) => {
  const ride = await prisma.ride.findUnique({ where: { id: rideId }, select: { status: true } });
  if (!ride) {
    throw new Error("Ride not found");
  }
  return ride.status;
};

export const rideHistory = async (passengerId: string) => {
  return await prisma.ride.findMany({
    where: { passengerId },
    include: { route: { select: { name: true } }, driver: driverCard },
    orderBy: { createdAt: "desc" },
  });
};

export const allRidesByPassenger = rideHistory;

export const getCurrentRides = async (passengerId: string) => {
  return await prisma.ride.findMany({
    where: { passengerId, status: { in: ["Requested", "Accepted"] } },
    include: { route: { select: { name: true } }, driver: driverCard },
  });
};

export const rideDetails = async (rideId: string) => {
  return await prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      route: { select: { name: true } },
      driver: driverCard,
      passenger: { select: { name: true } },
    },
  });
};

export const allRidesByDriver = async (driverId: string) => {
  return await prisma.ride.findMany({
    where: { driverId },
    include: { passenger: { select: { name: true, phone: true } }, route: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
};

/** Pool currently offered to (or accepted by) a driver, ordered by pickup sequence. */
export const currentPoolForDriver = async (driverId: string) => {
  return await prisma.ride.findMany({
    where: { driverId, status: { in: ["Requested", "Accepted"] } },
    include: { passenger: { select: { name: true, phone: true } } },
    orderBy: [{ pickupSequence: "asc" }],
  });
};

/** Online/offline toggle. Whether a driver is busy is derived from their active rides. */
export const driverAvailability = async (driverId: string, isAvailable: boolean) => {
  const driver = await prisma.driver.update({ where: { id: driverId }, data: { isAvailable } });
  if (isAvailable) scheduleMatching(500);
  return driver;
};

export const driverStats = async (driverId: string) => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

  const rides = await prisma.ride.findMany({
    where: { driverId, status: { in: ["Completed", "Cancelled"] } },
    select: { status: true, fare: true, rating: true, completedAt: true, createdAt: true },
  });
  const completed = rides.filter((r) => r.status === "Completed");
  const sumSince = (since: Date) =>
    completed.filter((r) => (r.completedAt ?? r.createdAt) >= since).reduce((s, r) => s + (r.fare ?? 0), 0);
  const rated = completed.filter((r) => r.rating != null);

  return {
    todayTrips: completed.filter((r) => (r.completedAt ?? r.createdAt) >= startOfDay).length,
    todayEarnings: Math.round(sumSince(startOfDay)),
    thisWeekEarnings: Math.round(sumSince(weekAgo)),
    thisMonthEarnings: Math.round(sumSince(monthAgo)),
    completedRides: completed.length,
    cancelledRides: rides.length - completed.length,
    rating: rated.length ? Math.round((rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) * 10) / 10 : 0,
    reviewCount: rated.length,
  };
};
