import "dotenv/config";
import http from "http";
import app from "./app.ts";
import { Server } from "socket.io";

const PORT = process.env.PORT || 5000;


const server = http.createServer(app);

// 🔥 attach socket.io
export const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// 🔥 socket connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // join room (IMPORTANT)
  socket.on("joinRoom", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// 🔥 start server
//console.log("DATABASE_URL:", process.env.DATABASE_URL)
server.listen(PORT, () => {
  console.log(`Server running with Socket.io at ${PORT}`);
});