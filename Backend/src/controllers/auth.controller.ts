import type { Request, Response } from "express";
import { sendOtp, verifyOtp } from "../services/auth.services.ts";
import { prisma } from "../lib/prisma.ts";


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
    const { phone, otp, role } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP required" });
    }

    const { user, accessToken } = await verifyOtp(phone, otp);

    if (!user) throw new Error("User not found");

    // Standardize role to matching Prisma enum
    const userRole = role === "DRIVER" ? "Driver" : "Passenger";

    const dbUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        role: userRole
      },
      create: {
        id: user.id,
        phone: user.phone ?? "",
        role: userRole
      },
      include: {
        driver: true
      }
    });

    // A driver account needs a Driver profile before it can receive rides.
    if (userRole === "Driver" && !dbUser.driver) {
      const route = await prisma.route.findFirst();
      await prisma.driver.create({
        data: {
          userId: dbUser.id,
          licenseNumber: "PENDING",
          routeId: route?.id ?? null,
          currentLocationLat: route?.startLat ?? 28.6139,
          currentLocationLng: route?.startLng ?? 77.209,
        },
      });
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: dbUser.id },
      include: { driver: true },
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: fullUser,
      token: accessToken
    });

  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};