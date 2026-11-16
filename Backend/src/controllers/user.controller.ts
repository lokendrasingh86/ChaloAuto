import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.ts";
import { getAuthUser } from "../middleware/verifyUser.middleware.ts";

const include = {
  driver: { include: { vehicle: true, route: true } },
} as const;

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (id !== getAuthUser(req).id) {
      return res.status(403).json({ message: "You can only view your own profile" });
    }
    const user = await prisma.user.findUnique({ where: { id }, include });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

/** PUT /users/:id — update the caller's own profile (name only; the phone number is their login identity). */
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (id !== getAuthUser(req).id) {
      return res.status(403).json({ message: "You can only update your own profile" });
    }
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
    if (name === undefined || name.length === 0 || name.length > 80) {
      return res.status(400).json({ message: "A name of 1 to 80 characters is required" });
    }
    const user = await prisma.user.update({ where: { id }, data: { name }, include });
    return res.status(200).json(user);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const getAvailableDrivers = async (_req: Request, res: Response) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: { isAvailable: true },
      select: {
        id: true,
        currentLocationLat: true,
        currentLocationLng: true,
        capacity: true,
        routeId: true,
        user: { select: { name: true } },
        vehicle: true,
        route: { select: { id: true, name: true } },
      },
    });
    return res.status(200).json({ drivers });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};
