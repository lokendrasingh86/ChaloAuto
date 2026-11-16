import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import path from "node:path";

process.env.SIMULATION_RESULTS_DIR = path.resolve(import.meta.dirname, "../../Simulation/results");
process.env.DISABLE_MATCHING_LOOP = "true";

let server: Server;
let base = "";

before(async () => {
  const { default: app } = await import("../src/app.ts");
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

test("GET /health is public", async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "OK");
});

test("GET /api/simulation/summary serves the simulation results", async () => {
  const res = await fetch(`${base}/api/simulation/summary`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.baseline.length > 0);
  assert.ok(body.demand.length > 0);
});

for (const [method, url] of [
  ["GET", "/api/rides/passenger/x/history"],
  ["POST", "/api/rides/request"],
  ["POST", "/api/rides/accept"],
  ["GET", "/api/users/x"],
  ["PUT", "/api/users/x"],
  ["GET", "/api/routes"],
  ["POST", "/api/routes"],
] as const) {
  test(`${method} ${url} requires a token`, async () => {
    const init: RequestInit = { method, headers: { "content-type": "application/json" } };
    if (method !== "GET") init.body = "{}";
    const res = await fetch(`${base}${url}`, init);
    assert.equal(res.status, 401);
  });
}
