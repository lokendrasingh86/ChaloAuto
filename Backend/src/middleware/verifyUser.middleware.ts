import type { NextFunction, Request, RequestHandler, Response } from "express";
import { supabase } from "../config/supabase.ts";
import { prisma } from "../lib/prisma.ts";
import { verifyLocalToken } from "../lib/tokens.ts";

export interface AuthedUser {
  id: string;
}

export const getAuthUser = (req: Request): AuthedUser => (req as any).user as AuthedUser;
export const getAuthDriverId = (req: Request): string | undefined => (req as any).driverId as string | undefined;

/** Verifies the Bearer token (Supabase session, or a dev test-login token) and sets req.user. */
export const verifyUser: RequestHandler = async (req, res, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  const local = verifyLocalToken(token);
  if (local) {
    (req as any).user = { id: local.sub };
    return next();
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid token" });
    }
    (req as any).user = { id: data.user.id };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/** Must run after verifyUser. Loads the caller's Driver profile and sets req.driverId. */
export const requireDriver: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const driver = await prisma.driver.findUnique({ where: { userId: getAuthUser(req).id }, select: { id: true } });
  if (!driver) {
    return res.status(403).json({ message: "Only drivers can do this" });
  }
  (req as any).driverId = driver.id;
  return next();
};

/** Must run after verifyUser. Only passengers may continue. */
export const requirePassenger: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const user = await prisma.user.findUnique({ where: { id: getAuthUser(req).id }, select: { role: true } });
  if (!user || user.role !== "Passenger") {
    return res.status(403).json({ message: "Only passengers are allowed to do this" });
  }
  return next();
};
