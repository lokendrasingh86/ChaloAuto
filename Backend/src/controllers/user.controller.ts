import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            vehicle: true,
            route: true
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.status(200).json(user);
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};

export const getAvailableDrivers = async (req: Request, res: Response) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: { isAvailable: true },
      include: {
        user: true,
        vehicle: true,
        route: true
      }
    });
    
    return res.status(200).json({ drivers });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};