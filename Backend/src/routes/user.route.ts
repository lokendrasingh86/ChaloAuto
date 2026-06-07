import { Router } from "express";
import { getUserProfile, getAvailableDrivers } from "../controllers/user.controller.js";

const router = Router();

router.get("/drivers/available", getAvailableDrivers);
router.get("/:id", getUserProfile);

export default router;