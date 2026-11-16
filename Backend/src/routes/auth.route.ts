import { Router } from "express";
import { requestOtp, verifyOtpController } from "../controllers/auth.controller.ts";

const router = Router();

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtpController);

export default router;
