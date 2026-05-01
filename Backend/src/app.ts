import express from "express";
import cors from "cors";
import apiRouter from "./routes/index.route.ts";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Default API routes (which bundles auth, rides, and routes)
app.use("/api", apiRouter);

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "OK", message: "Server is running smoothly!" });
});

export default app;
