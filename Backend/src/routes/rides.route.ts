import { Router } from "express";
import {
  requestRideController,
  acceptRideController,
  completeRideController,
  cancelRideController,
  getRideStatusController,
  rideHistoryController,
  allRidesByPassengerController,
  getCurrentRidesController,
  rideDetailsController,
  allRidesByDriverController,
  driverAvailabilityController,
  updateDriverLocationController
} from "../controllers/ride.controller.ts";

const router = Router();

// Route Point & Ride Requests 
router.post("/request", requestRideController);

// Ride Lifecycle Actions
router.post("/accept", acceptRideController);
router.post("/complete", completeRideController);
router.post("/cancel", cancelRideController);

// Ride Status and Details
router.get("/:rideId/status", getRideStatusController);
router.get("/:rideId/details", rideDetailsController);

// Passenger specific queries
router.get("/passenger/:passengerId/history", rideHistoryController);
router.get("/passenger/:passengerId/all", allRidesByPassengerController);
router.get("/passenger/:passengerId/current", getCurrentRidesController);

// Driver specific queries and actions
router.get("/driver/:driverId/all", allRidesByDriverController);
router.post("/driver/availability", driverAvailabilityController);
router.post("/driver/location", updateDriverLocationController);

export default router;