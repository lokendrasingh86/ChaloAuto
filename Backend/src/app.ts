import express from "express";
import cors from "cors";
import apiRouter from "./routes/index.route.ts";

const app = express();

const origins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors(origins && origins.length ? { origin: origins } : undefined));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// All API routes (auth, rides, routes, users, simulation)
app.use("/api", apiRouter);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running smoothly!" });
});

export default app;
