import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();

// The simulation lives in ../Simulation (sibling of Backend).
const candidateDirs = [
  process.env.SIMULATION_RESULTS_DIR,
  path.resolve(process.cwd(), "../Simulation/results"),
  path.resolve(process.cwd(), "Simulation/results"),
].filter((d): d is string => Boolean(d));

const readCsv = (file: string): Record<string, string | number>[] => {
  const raw = fs.readFileSync(file, "utf-8").trim();
  const [headerLine, ...lines] = raw.split(/\r?\n/);
  if (!headerLine) return [];
  const headers = headerLine.split(",");
  return lines
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(",");
      const row: Record<string, string | number> = {};
      headers.forEach((h, i) => {
        const v = cells[i] ?? "";
        row[h] = v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v;
      });
      return row;
    });
};

// GET /api/simulation/summary -> aggregated results of the pooling simulation
router.get("/summary", (_req, res) => {
  const dir = candidateDirs.find((d) =>
    fs.existsSync(path.join(d, "summary.csv")) && fs.existsSync(path.join(d, "demand_summary.csv")),
  );
  try {
    if (!dir) {
      // Same saved results already shipped by the frontend. This is a snapshot,
      // not a new simulation run. Keep a backend copy for Backend-only deploys.
      return res.json(JSON.parse(fs.readFileSync(new URL("../../data/simulation-summary.json", import.meta.url), "utf-8")));
    }
    res.json({
      baseline: readCsv(path.join(dir, "summary.csv")),
      demand: readCsv(path.join(dir, "demand_summary.csv")),
    });
  } catch (err) {
    console.error("Failed to read simulation results", err);
    res.status(500).json({ error: "Failed to read simulation results" });
  }
});

export default router;
