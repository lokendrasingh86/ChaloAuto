import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateFare, tripDistanceKm, BASE_FARE } from "../src/lib/fare.ts";
import { distance, snapToPolyline, type Point } from "../src/algorithms/geo.ts";
import { signLocalToken, verifyLocalToken } from "../src/lib/tokens.ts";

test("haversine distance is about right", () => {
  const km = distance([28.6304, 77.2177], [28.5562, 77.1]);
  assert.ok(km > 14 && km < 17, `got ${km}`);
});

test("snapToPolyline snaps to the closest segment", () => {
  const line: Point[] = [[28.0, 77.0], [28.0, 77.1], [28.1, 77.1]];
  const snapped = snapToPolyline([28.0005, 77.05], line)!;
  assert.ok(snapped.km < 0.1);
  assert.ok(Math.abs(snapped.point[0] - 28.0) < 1e-6);
});

test("fare has a minimum and a pooled discount", () => {
  assert.equal(calculateFare(1).fare, BASE_FARE);
  const solo = calculateFare(10, 1).fare;
  const pooled = calculateFare(10, 2).fare;
  assert.ok(pooled < solo);
  assert.equal(calculateFare(10, 2).pooled, true);
  assert.ok(tripDistanceKm([28.6, 77.2], [28.5, 77.1]) > 10);
});

test("test-login tokens verify, and tampering or expiry is rejected", () => {
  process.env.JWT_SECRET = "unit-test-secret";
  const token = signLocalToken("user-1");
  assert.equal(verifyLocalToken(token)?.sub, "user-1");
  assert.equal(verifyLocalToken(token + "x"), null);
  assert.equal(verifyLocalToken(signLocalToken("user-1", -10)), null);
  process.env.ALLOW_TEST_LOGIN = "false";
  assert.equal(verifyLocalToken(token), null);
  delete process.env.ALLOW_TEST_LOGIN;
});
