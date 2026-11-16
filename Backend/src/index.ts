import "dotenv/config";
import http from "node:http";
import app from "./app.ts";
import { initSocket } from "./lib/socket.ts";
import { startMatchingLoop } from "./services/matching.service.ts";

const PORT = Number(process.env.PORT) || 8000;

const server = http.createServer(app);
initSocket(server);
startMatchingLoop();

server.listen(PORT, () => {
  console.log(`Server running with Socket.io at ${PORT}`);
});
