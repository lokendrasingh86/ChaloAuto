import type http from "node:http";
import { Server } from "socket.io";
import { supabase } from "../config/supabase.ts";
import { prisma } from "./prisma.ts";
import { verifyLocalToken } from "./tokens.ts";

let io: Server | null = null;

export const getIo = () => io;

/** Attach Socket.io. Clients authenticate with their token and are put in their own rooms. */
export function initSocket(server: http.Server): Server {
  io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*" },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("No token"));

      let userId = verifyLocalToken(token)?.sub;
      if (!userId) {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) return next(new Error("Invalid token"));
        userId = data.user.id;
      }
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Auth failed"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    socket.join(userId);
    try {
      const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true } });
      if (driver) socket.join(driver.id);
    } catch (err) {
      console.error("Socket driver lookup failed", err);
    }

    // Kept for older clients: rooms are now joined automatically from the token,
    // so only the caller's own ids are honoured.
    socket.on("joinRoom", async (roomId: string) => {
      if (roomId === userId) return socket.join(roomId);
      const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true } }).catch(() => null);
      if (driver && driver.id === roomId) socket.join(roomId);
    });
  });

  return io;
}

export const emitToUser = (roomId: string, event: string, data: unknown) => {
  io?.to(roomId).emit(event, data);
};
