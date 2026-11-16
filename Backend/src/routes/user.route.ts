import { Router } from "express";
import { getUserProfile, updateUserProfile, getAvailableDrivers } from "../controllers/user.controller.ts";
import { verifyUser } from "../middleware/verifyUser.middleware.ts";

const router = Router();

router.use(verifyUser);
router.get("/drivers/available", getAvailableDrivers);
router.get("/:id", getUserProfile);
router.put("/:id", updateUserProfile);

export default router;
