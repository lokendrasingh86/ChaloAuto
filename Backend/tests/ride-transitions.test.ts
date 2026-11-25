import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma.ts";
import { acceptRide, cancelRide, completeRide, declineRide, rateRide } from "../src/services/ride.service.ts";
import { releasePool, runMatching, stopMatchingLoop } from "../src/services/matching.service.ts";

afterEach(() => stopMatchingLoop());

// Run the real service functions. Only the database boundary is replaced so a
// concurrent write can be scheduled precisely between the read and mutation.
// These tests do not replace PostgreSQL integration/concurrency testing.
function database(t: any, initial: Record<string, any>, concurrent?: (row: any) => void) {
  const row: any = { id: "r1", passengerId: "p1", driverId: "d1", poolId: "pool1", status: "Requested",
    pickupLat: 28.63, pickupLng: 77.21, dropLat: 28.59, dropLng: 77.16,
    plannerMode: "Legacy", rating: null, createdAt: new Date(0), matchedAt: new Date(0),
    driver: { id: "d1", userId: "u1", currentLocationLat: 28.63, currentLocationLng: 77.21,
      user: { name: "Fixture", phone: "000" }, vehicle: null }, ...initial };
  function matches(where: any = {}): boolean {
    return Object.entries(where).every(([key, condition]: [string, any]) => {
      if (condition && typeof condition === "object" && !(condition instanceof Date)) {
        if ("in" in condition) return condition.in.includes(row[key]);
        if ("not" in condition) return row[key] !== condition.not;
        if ("lt" in condition) return row[key] < condition.lt;
      }
      if (condition instanceof Date) return row[key]?.getTime() === condition.getTime();
      return row[key] === condition;
    });
  }
  let raced = false;
  const mutate = async ({ where, data }: any, many: boolean) => {
    if (!raced && concurrent) { raced = true; concurrent(row); }
    if (!matches(where)) {
      if (many) return { count: 0 };
      throw new Error("Record no longer matches");
    }
    Object.assign(row, data);
    return many ? { count: 1 } : structuredClone(row);
  };
  function replace(target: any, key: string, implementation: (...args: any[]) => any) {
    const original = target[key];
    target[key] = implementation;
    t.after(() => { target[key] = original; });
  }
  replace(prisma.ride, "findFirst", async ({ where }: any) => matches(where) ? structuredClone(row) : null);
  replace(prisma.ride, "findUnique", async ({ where }: any) => matches(where) ? structuredClone(row) : null);
  replace(prisma.ride, "findUniqueOrThrow", async ({ where }: any) => {
    if (!matches(where)) throw new Error("Missing fixture");
    return structuredClone(row);
  });
  replace(prisma.ride, "findMany", async ({ where }: any) => matches(where) ? [structuredClone(row)] : []);
  replace(prisma.ride, "count", async ({ where }: any) => matches(where) ? 1 : 0);
  replace(prisma.ride, "update", (args: any) => mutate(args, false));
  replace(prisma.ride, "updateMany", (args: any) => mutate(args, true));
  replace(prisma, "$transaction", async (operations: any) => typeof operations === "function" ? operations(prisma) : Promise.all(operations));
  return row;
}

for (const [label, action, initial, race, expectedStatus] of [
  ["accept cannot resurrect a cancelled ride", () => acceptRide("r1", "d1"), {}, (r: any) => { r.status = "Cancelled"; }, "Cancelled"],
  ["accept cannot claim a reassigned offer", () => acceptRide("r1", "d1"), {}, (r: any) => { r.driverId = "d2"; r.poolId = "pool2"; }, "Requested"],
  ["complete cannot resurrect a cancelled ride", () => completeRide("r1", "d1"), { status: "Accepted" }, (r: any) => { r.status = "Cancelled"; }, "Cancelled"],
  ["cancel cannot overwrite completion", () => cancelRide("r1", "p1"), { status: "Accepted" }, (r: any) => { r.status = "Completed"; }, "Completed"],
  ["decline cannot detach an accepted solo ride", () => declineRide("r1", "d1"), { poolId: null }, (r: any) => { r.status = "Accepted"; }, "Accepted"],
  ["a second rating cannot overwrite a concurrent first rating", () => rateRide("r1", "p1", 5), { status: "Completed" }, (r: any) => { r.rating = 3; }, "Completed"],
] as const) {
  test(label, async (t) => {
    const row = database(t, initial, race);
    await assert.rejects(action);
    assert.equal(row.status, expectedStatus);
    if (label.includes("rating")) assert.equal(row.rating, 3);
    if (label.includes("reassigned")) assert.equal(row.driverId, "d2");
  });
}

test("offer expiry cannot detach a ride accepted after the snapshot", async (t) => {
  const row = database(t, {}, (r) => { r.status = "Accepted"; });
  assert.equal(await releasePool("pool1", "d1", "expired"), 0);
  assert.equal(row.status, "Accepted");
  assert.equal(row.driverId, "d1");
  assert.equal(row.poolId, "pool1");
});

test("max-wait expiry cannot cancel a newly matched request", async (t) => {
  const row = database(t, { driverId: null }, (r) => { r.driverId = "d2"; r.matchedAt = new Date(); });
  await runMatching();
  assert.equal(row.status, "Requested");
  assert.equal(row.driverId, "d2");
});

test("normal acceptance, completion and first rating still persist", async (t) => {
  const row = database(t, {});
  const accepted = await acceptRide("r1", "d1");
  assert.equal(accepted.status, "Accepted");
  assert.equal(row.status, "Accepted");
  const completed = await completeRide("r1", "d1");
  assert.equal(completed.ride.status, "Completed");
  assert.ok((completed.ride.fare ?? 0) > 0);
  const rated = await rateRide("r1", "p1", 4);
  assert.equal(rated.rating, 4);
});
