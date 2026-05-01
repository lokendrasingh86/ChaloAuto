import type { NextFunction, RequestHandler } from "express";
import { supabase } from "../config/supabase.ts";

export const verifyUser: RequestHandler = async (req, res, next:NextFunction) => {

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ message: "Invalid token" });
  }

  (req as any).user = data.user;

  next();
};