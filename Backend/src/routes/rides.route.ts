import { Router } from "express";
import {
  requestRideController,
  acceptRideController,
  declineRideController,
  completeRideController,
  cancelRideController,
  rateRideController,
  getRideStatusController,
  rideHistoryController,
  allRidesByPassengerController,
  getCurrentRidesController,
  rideDetailsController,
  allRidesByDriverController,
  driverAvailabilityController,
  updateDriverLocationController,
  driverStatsController,
  currentPoolController,
  cleanupAcceptedRidesController,
} from "../controllers/ride.controller.ts";
import { requireDriver, requirePassenger, verifyUser } from "../middleware/verifyUser.middleware.ts";

const router = Router();

// Every ride endpoint needs a logged-in user.
router.use(verifyUser);

// Passenger actions
router.post("/request", requirePassenger, requestRideController);
router.post("/rate", requirePassenger, rateRideController);
router.get("/passenger/:passengerId/history", rideHistoryController);
router.get("/passenger/:passengerId/all", allRidesByPassengerController);
router.get("/passenger/:passengerId/current", getCurrentRidesController);

// Driver actions
router.post("/accept", requireDriver, acceptRideController);
router.post("/decline", requireDriver, declineRideController);
router.post("/complete", requireDriver, completeRideController);
router.post("/driver/availability", requireDriver, driverAvailabilityController);
router.post("/driver/location", requireDriver, updateDriverLocationController);
router.get("/driver/:driverId/all", requireDriver, allRidesByDriverController);
router.get("/driver/:driverId/stats", requireDriver, driverStatsController);
router.get("/driver/:driverId/current", requireDriver, currentPoolController);

// Either side
router.post("/cancel", cancelRideController);
router.get("/:rideId/status", getRideStatusController);
router.get("/:rideId/details", rideDetailsController);

// Cleanup (testing only, disabled in production)
router.post("/cleanup/accepted", requireDriver, cleanupAcceptedRidesController);

export default router;
