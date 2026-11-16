import type { Request, RequestHandler, Response } from "express";
import { prisma } from "../lib/prisma.ts";
import { getAuthDriverId, getAuthUser } from "../middleware/verifyUser.middleware.ts";
import * as rideService from "../services/ride.service.ts";

/** Wraps an async handler so service errors become `400 { error }` like before. */
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      if (!res.headersSent) res.status(400).json({ error: message });
    }
  };

const param = (req: Request, name: string): string => String(req.params[name] ?? "");

/** Resolves to true if the caller is the ride's passenger or its driver. */
async function isParticipant(rideId: string, userId: string): Promise<boolean> {
  const ride = await prisma.ride.findUnique({
    where: { id: rideId },
    select: { passengerId: true, driver: { select: { userId: true } } },
  });
  return !!ride && (ride.passengerId === userId || ride.driver?.userId === userId);
}

export const requestRideController: RequestHandler = wrap(async (req, res) => {
  const userId = getAuthUser(req).id;
  const { passengerId, pickupLat, pickupLng, dropLat, dropLng } = req.body ?? {};
  if (passengerId && passengerId !== userId) {
    return res.status(403).json({ message: "You can only request rides for yourself" });
  }
  if (pickupLat === undefined || pickupLng === undefined) {
    return res.status(400).json({ message: "pickupLat and pickupLng are required" });
  }
  const ride = await rideService.requestRide(userId, Number(pickupLat), Number(pickupLng),
    dropLat === undefined || dropLat === null ? null : Number(dropLat),
    dropLng === undefined || dropLng === null ? null : Number(dropLng));
  return res.status(201).json({ ride });
});

export const acceptRideController: RequestHandler = wrap(async (req, res) => {
  const { rideId } = req.body ?? {};
  if (!rideId) return res.status(400).json({ message: "rideId is required" });
  const ride = await rideService.acceptRide(rideId, getAuthDriverId(req)!);
  return res.status(200).json({ ride });
});

export const declineRideController: RequestHandler = wrap(async (req, res) => {
  const { rideId } = req.body ?? {};
  if (!rideId) return res.status(400).json({ message: "rideId is required" });
  return res.status(200).json(await rideService.declineRide(rideId, getAuthDriverId(req)!));
});

export const completeRideController: RequestHandler = wrap(async (req, res) => {
  const { rideId } = req.body ?? {};
  if (!rideId) return res.status(400).json({ message: "rideId is required" });
  return res.status(200).json(await rideService.completeRide(rideId, getAuthDriverId(req)!));
});

export const cancelRideController: RequestHandler = wrap(async (req, res) => {
  const { rideId } = req.body ?? {};
  if (!rideId) return res.status(400).json({ message: "rideId is required" });
  return res.status(200).json(await rideService.cancelRide(rideId, getAuthUser(req).id));
});

export const rateRideController: RequestHandler = wrap(async (req, res) => {
  const { rideId, rating, comment } = req.body ?? {};
  if (!rideId || rating === undefined) {
    return res.status(400).json({ message: "rideId and rating are required" });
  }
  const ride = await rideService.rateRide(rideId, getAuthUser(req).id, Number(rating), comment);
  return res.status(200).json({ ride });
});

export const getRideStatusController: RequestHandler = wrap(async (req, res) => {
  const rideId = param(req, "rideId");
  if (!(await isParticipant(rideId, getAuthUser(req).id))) {
    return res.status(403).json({ message: "Not allowed" });
  }
  return res.status(200).json({ status: await rideService.getRideStatus(rideId) });
});

export const rideDetailsController: RequestHandler = wrap(async (req, res) => {
  const rideId = param(req, "rideId");
  if (!(await isParticipant(rideId, getAuthUser(req).id))) {
    return res.status(403).json({ message: "Not allowed" });
  }
  return res.status(200).json({ ride: await rideService.rideDetails(rideId) });
});

const ownPassenger = (req: Request, res: Response): string | null => {
  const passengerId = param(req, "passengerId");
  if (passengerId !== getAuthUser(req).id) {
    res.status(403).json({ message: "Not allowed" });
    return null;
  }
  return passengerId;
};

export const rideHistoryController: RequestHandler = wrap(async (req, res) => {
  const passengerId = ownPassenger(req, res);
  if (!passengerId) return;
  return res.status(200).json({ history: await rideService.rideHistory(passengerId) });
});

export const allRidesByPassengerController: RequestHandler = rideHistoryController;

export const getCurrentRidesController: RequestHandler = wrap(async (req, res) => {
  const passengerId = ownPassenger(req, res);
  if (!passengerId) return;
  return res.status(200).json({ currentRides: await rideService.getCurrentRides(passengerId) });
});

const ownDriver = (req: Request, res: Response): string | null => {
  const driverId = param(req, "driverId");
  if (driverId !== getAuthDriverId(req)) {
    res.status(403).json({ message: "Not allowed" });
    return null;
  }
  return driverId;
};

export const allRidesByDriverController: RequestHandler = wrap(async (req, res) => {
  const driverId = ownDriver(req, res);
  if (!driverId) return;
  return res.status(200).json({ history: await rideService.allRidesByDriver(driverId) });
});

export const driverStatsController: RequestHandler = wrap(async (req, res) => {
  const driverId = ownDriver(req, res);
  if (!driverId) return;
  return res.status(200).json({ stats: await rideService.driverStats(driverId) });
});

export const currentPoolController: RequestHandler = wrap(async (req, res) => {
  const driverId = ownDriver(req, res);
  if (!driverId) return;
  return res.status(200).json({ rides: await rideService.currentPoolForDriver(driverId) });
});

export const driverAvailabilityController: RequestHandler = wrap(async (req, res) => {
  const { isAvailable } = req.body ?? {};
  if (typeof isAvailable !== "boolean") {
    return res.status(400).json({ message: "isAvailable (boolean) is required" });
  }
  const driver = await rideService.driverAvailability(getAuthDriverId(req)!, isAvailable);
  return res.status(200).json({ driver });
});

export const updateDriverLocationController: RequestHandler = wrap(async (req, res) => {
  const { lat, lng } = req.body ?? {};
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ message: "lat and lng are required" });
  }
  const driver = await rideService.updateDriverLocation(getAuthDriverId(req)!, Number(lat), Number(lng));
  return res.status(200).json({ driver });
});

/** Testing helper: removes Accepted rides. Disabled in production. */
export const cleanupAcceptedRidesController: RequestHandler = wrap(async (_req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ message: "Disabled in production" });
  }
  const deleted = await prisma.ride.deleteMany({ where: { status: "Accepted" } });
  return res.status(200).json({ message: `Deleted ${deleted.count} accepted rides`, count: deleted.count });
});
