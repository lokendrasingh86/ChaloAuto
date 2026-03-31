import { Router } from "express";
import { findNearestRoute, requestRideController } from "../controllers/ride.controller.ts";

const router = Router();

router.post("/find-nearest-route", findNearestRoute);
router.post("/request-ride", requestRideController);
export default router;