import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFeasiblePool,
  normalizeFeatures,
  planSystemAware,
  systemAwareAssignment,
  type Driver,
  type Passenger,
} from "../src/algorithms/systemAware.ts";

// Tiny deterministic RNG so the random candidates are reproducible.
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const d = (id: string, lat: number, lng: number, capacity = 4): Driver => ({ id, location: [lat, lng], capacity });
const p = (id: string, pickup: [number, number], destination: [number, number]): Passenger => ({ id, pickup, destination });

// Two riders going the same way along one road, plus one rider going the opposite way.
const p1 = p("p1", [28.6, 77.2], [28.55, 77.2]);
const p2 = p("p2", [28.598, 77.2], [28.552, 77.2]);
const p3 = p("p3", [28.55, 77.3], [28.62, 77.3]);

test("returns nothing without passengers or drivers", () => {
  assert.equal(systemAwareAssignment([], [d("a", 28.6, 77.2)]).size, 0);
  assert.equal(systemAwareAssignment([p1], []).size, 0);
});

test("pools passengers heading the same way into one auto", () => {
  const drivers = [d("a", 28.601, 77.2), d("b", 28.56, 77.3)];
  const result = systemAwareAssignment([p1, p2], drivers, 0.5, "Balanced", seeded(1));
  const sizes = [...result.values()].map((pool) => pool.length);
  assert.deepEqual(sizes, [2]);
});

test("every passenger is assigned at most once and only to a listed driver", () => {
  const drivers = [d("a", 28.601, 77.2), d("b", 28.56, 77.3), d("c", 28.58, 77.25)];
  const result = systemAwareAssignment([p1, p2, p3], drivers, 0.5, "Balanced", seeded(7));
  const ids = [...result.values()].flat().map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const driverId of result.keys()) assert.ok(drivers.some((x) => x.id === driverId));
  assert.equal(ids.length, 3);
});

test("never exceeds driver capacity", () => {
  const crowd = ["a", "b", "c", "d"].map((id, i) => p(id, [28.6 - i * 0.001, 77.2], [28.55, 77.2]));
  const result = systemAwareAssignment(crowd, [d("x", 28.601, 77.2, 2), d("y", 28.602, 77.2, 2)], 0.5, "Balanced", seeded(3));
  for (const pool of result.values()) assert.ok(pool.length <= 2);
});

test("pool whose detour is too large is infeasible", () => {
  const driver = d("a", 28.6, 77.2);
  assert.equal(isFeasiblePool(driver, [p1, p3], 0.5), false);
  assert.equal(isFeasiblePool(driver, [p1, p2], 0.5), true);
});

test("planSystemAware returns a stop order with pickups before drop-offs", () => {
  const plans = planSystemAware([p1, p2], [d("a", 28.601, 77.2)], 0.5, "Balanced", seeded(2));
  assert.equal(plans.length, 1);
  const types = plans[0]!.route.map(([type]) => type);
  assert.deepEqual(types, ["pickup", "pickup", "dropoff", "dropoff"]);
  assert.ok(plans[0]!.routeDistanceKm > 0);
});

test("normalizeFeatures maps each feature to 0..1", () => {
  const out = normalizeFeatures([
    { pickup_burden: 1, route_distance: 10, detour: 0, vehicles: 1, unassigned_ratio: 0 },
    { pickup_burden: 3, route_distance: 30, detour: 0, vehicles: 2, unassigned_ratio: 0.5 },
  ]);
  assert.equal(out[0]!.pickup_burden, 0);
  assert.equal(out[1]!.pickup_burden, 1);
  assert.equal(out[0]!.detour, 0); // constant feature -> 0
  assert.equal(out[1]!.unassigned_ratio, 1);
});
