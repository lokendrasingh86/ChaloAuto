import type { Request, Response } from "express";
import { sendOtp, verifyOtp } from "../services/auth.services.js";
import { prisma } from "../lib/prisma.js";


export const requestOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const response = await sendOtp(phone);

    return res.status(200).json(response);

  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};



export const verifyOtpController = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP required" });
    }

    const { user, accessToken } = await verifyOtp(phone, otp);

    const dbUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        phone: user.phone ?? "",
      },
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: dbUser,
      token: accessToken
    });

  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};