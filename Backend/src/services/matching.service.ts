/**
 * Batch matching: collects waiting ride requests per route and assigns them to
 * online drivers with the System-Aware algorithm from the simulation
 * (see algorithms/systemAware.ts, a port of system_aware_assignment()).
 */
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.ts";
import { emitToUser } from "../lib/socket.ts";
import { calculateFare, tripDistanceKm } from "../lib/fare.ts";
import { planSystemAware, type Driver, type Passenger } from "../algorithms/systemAware.ts";

const MAX_DETOUR_RATIO = Number(process.env.MAX_DETOUR_RATIO) || 0.5;
const WEIGHT_PROFILE = process.env.MATCHING_PROFILE || "Balanced";
const MATCH_INTERVAL_MS = (Number(process.env.MATCHING_INTERVAL_SECONDS) || 5) * 1000;
const MAX_WAIT_MS = (Number(process.env.MAX_WAIT_MINUTES) || 10) * 60_000; // simulator: passenger.max_wait
const DRIVER_RESPONSE_MS = (Number(process.env.DRIVER_RESPONSE_SECONDS) || 60) * 1000;
const BATCH_DELAY_MS = 1500;

/** rideId -> drivers who declined (or ignored) it, so it is not offered to them again. */
export const declinedBy = new Map<string, Set<string>>();

let running = false;
let rerun = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let loop: ReturnType<typeof setInterval> | null = null;

export function markDeclined(rideId: string, driverId: string) {
  const set = declinedBy.get(rideId) ?? new Set<string>();
  set.add(driverId);
  declinedBy.set(rideId, set);
}

/** Free a pool that was offered to a driver so it goes back into the waiting batch. */
export async function releasePool(poolId: string, driverId: string, notifyReason: string) {
  const rides = await prisma.ride.findMany({
    where: { poolId, driverId, status: "Requested" },
    select: { id: true, passengerId: true },
  });
  if (rides.length === 0) return 0;
  await prisma.ride.updateMany({
    where: { id: { in: rides.map((r) => r.id) } },
    data: { driverId: null, poolId: null, pickupSequence: null, dropSequence: null, matchedAt: null },
  });
  for (const r of rides) {
    markDeclined(r.id, driverId);
    emitToUser(r.passengerId, "rideUnmatched", { rideId: r.id, reason: notifyReason });
  }
  emitToUser(driverId, "requestExpired", { poolId });
  return rides.length;
}

async function expireStale() {
  const now = Date.now();

  // Passengers waiting longer than max wait are cancelled (simulator: max_wait).
  const stale = await prisma.ride.findMany({
    where: { status: "Requested", driverId: null, createdAt: { lt: new Date(now - MAX_WAIT_MS) } },
    select: { id: true, passengerId: true },
  });
  if (stale.length) {
    await prisma.ride.updateMany({ where: { id: { in: stale.map((r) => r.id) } }, data: { status: "Cancelled" } });
    for (const r of stale) {
      declinedBy.delete(r.id);
      emitToUser(r.passengerId, "rideCancelled", { rideId: r.id, reason: "No auto was available in time" });
    }
  }

  // Offers a driver ignored are released and re-matched.
  const ignored = await prisma.ride.findMany({
    where: { status: "Requested", driverId: { not: null }, matchedAt: { lt: new Date(now - DRIVER_RESPONSE_MS) } },
    select: { poolId: true, driverId: true },
    distinct: ["poolId"],
  });
  for (const o of ignored) {
    if (o.poolId && o.driverId) await releasePool(o.poolId, o.driverId, "Driver did not respond");
  }
}

async function matchOnce(): Promise<number> {
  await expireStale();

  const pending = await prisma.ride.findMany({
    where: {
      status: "Requested",
      driverId: null,
      routeId: { not: null },
      dropLat: { not: null },
      dropLng: { not: null },
    },
    include: { passenger: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (pending.length === 0) return 0;

  const routeIds = [...new Set(pending.map((r) => r.routeId!))];
  const [drivers, busyRows] = await Promise.all([
    prisma.driver.findMany({
      where: { isAvailable: true, routeId: { in: routeIds } },
      include: { user: { select: { name: true, phone: true } }, vehicle: true },
    }),
    prisma.ride.findMany({
      where: { driverId: { not: null }, status: { in: ["Requested", "Accepted"] } },
      select: { driverId: true },
      distinct: ["driverId"],
    }),
  ]);
  const busy = new Set(busyRows.map((r) => r.driverId));
  const idle = drivers.filter((d) => !busy.has(d.id));
  if (idle.length === 0) return 0;

  let created = 0;

  for (const routeId of routeIds) {
    const routeRides = pending.filter((r) => r.routeId === routeId);
    const routeDrivers = idle.filter((d) => d.routeId === routeId);
    if (routeRides.length === 0 || routeDrivers.length === 0) continue;

    const rideById = new Map(routeRides.map((r) => [r.id, r]));
    const driverById = new Map(routeDrivers.map((d) => [d.id, d]));

    const passengers: Passenger[] = routeRides.map((r) => ({
      id: r.id,
      pickup: [r.pickupLat, r.pickupLng],
      destination: [r.dropLat!, r.dropLng!],
    }));
    let available: Driver[] = routeDrivers.map((d) => ({
      id: d.id,
      location: [d.currentLocationLat, d.currentLocationLng],
      capacity: d.capacity,
    }));

    // Run the algorithm; drop drivers that were already declined by a passenger in their pool and retry.
    let plans = planSystemAware(passengers, available, MAX_DETOUR_RATIO, WEIGHT_PROFILE);
    for (let attempt = 0; attempt < routeDrivers.length; attempt++) {
      const bad = plans.filter((pl) => pl.passengers.some((p) => declinedBy.get(p.id)?.has(pl.driver.id)));
      if (bad.length === 0) break;
      const badIds = new Set(bad.map((b) => b.driver.id));
      available = available.filter((d) => !badIds.has(d.id));
      plans = available.length ? planSystemAware(passengers, available, MAX_DETOUR_RATIO, WEIGHT_PROFILE) : [];
    }

    for (const plan of plans) {
      const driver = driverById.get(plan.driver.id);
      if (!driver) continue;

      const poolId = crypto.randomUUID();
      const matchedAt = new Date();
      const pickupSeq = new Map<string, number>();
      const dropSeq = new Map<string, number>();
      for (const [type, p] of plan.route) {
        const map = type === "pickup" ? pickupSeq : dropSeq;
        map.set(p.id, map.size + 1);
      }

      const results = await prisma.$transaction(
        plan.passengers.map((p) => {
          const ride = rideById.get(p.id)!;
          const quote = calculateFare(tripDistanceKm(p.pickup, p.destination), plan.passengers.length);
          return prisma.ride.updateMany({
            where: { id: ride.id, status: "Requested", driverId: null },
            data: {
              driverId: driver.id,
              poolId,
              pickupSequence: pickupSeq.get(p.id) ?? null,
              dropSequence: dropSeq.get(p.id) ?? null,
              matchedAt,
              distanceKm: quote.distanceKm,
              fare: quote.fare,
            },
          });
        }),
      );

      const matched = plan.passengers.filter((_, i) => results[i]!.count === 1);
      if (matched.length === 0) continue;
      created += 1;

      const matchedIds = new Set(matched.map((m) => m.id));
      const stops = plan.route
        .filter(([, p]) => matchedIds.has(p.id))
        .map(([type, p]) => ({
          type,
          rideId: p.id,
          passengerName: rideById.get(p.id)?.passenger.name ?? "Passenger",
          lat: type === "pickup" ? p.pickup[0] : p.destination[0],
          lng: type === "pickup" ? p.pickup[1] : p.destination[1],
        }));

      const rides = matched.map((p) => {
        const r = rideById.get(p.id)!;
        const quote = calculateFare(tripDistanceKm(p.pickup, p.destination), matched.length);
        return {
          rideId: r.id,
          passengerId: r.passengerId,
          passengerName: r.passenger.name ?? "Passenger",
          passengerPhone: r.passenger.phone,
          pickupLat: r.pickupLat,
          pickupLng: r.pickupLng,
          dropLat: r.dropLat,
          dropLng: r.dropLng,
          pickupSequence: pickupSeq.get(r.id) ?? null,
          dropSequence: dropSeq.get(r.id) ?? null,
          fare: quote.fare,
          distanceKm: quote.distanceKm,
        };
      });

      const first = rides[0]!;
      emitToUser(driver.id, "newRideRequest", {
        poolId,
        rides,
        stops,
        routeDistanceKm: Math.round(plan.routeDistanceKm * 100) / 100,
        // legacy single-ride fields
        rideId: first.rideId,
        passengerId: first.passengerId,
        pickupLat: first.pickupLat,
        pickupLng: first.pickupLng,
      });

      for (const r of rides) {
        emitToUser(r.passengerId, "rideMatched", {
          rideId: r.rideId,
          poolId,
          pickupSequence: r.pickupSequence,
          fare: r.fare,
          pooled: rides.length > 1,
          driver: {
            id: driver.id,
            name: driver.user.name,
            phone: driver.user.phone,
            licenseNumber: driver.licenseNumber,
            vehicle: driver.vehicle ? `${driver.vehicle.make} ${driver.vehicle.model}` : null,
          },
        });
      }
    }
  }
  return created;
}

/** Runs one matching pass; overlapping calls are queued so passes never run concurrently. */
export async function runMatching(): Promise<number> {
  if (running) {
    rerun = true;
    return 0;
  }
  running = true;
  let created = 0;
  try {
    created = await matchOnce();
  } catch (err) {
    console.error("Matching failed", err);
  } finally {
    running = false;
  }
  if (rerun) {
    rerun = false;
    void runMatching();
  }
  return created;
}

/** Called after a new request: waits briefly so near-simultaneous requests are matched as one batch. */
export function scheduleMatching(delay = BATCH_DELAY_MS) {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void runMatching();
  }, delay);
}

export function startMatchingLoop() {
  if (loop || process.env.DISABLE_MATCHING_LOOP === "true") return;
  loop = setInterval(() => void runMatching(), MATCH_INTERVAL_MS);
  loop.unref?.();
}

export function stopMatchingLoop() {
  if (loop) clearInterval(loop);
  loop = null;
  if (debounce) clearTimeout(debounce);
  debounce = null;
}
