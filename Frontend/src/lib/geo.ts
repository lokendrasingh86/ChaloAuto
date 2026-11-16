export type LatLng = [number, number];

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(rad(a[0])) * Math.cos(rad(b[0]));
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Mirrors Backend/src/lib/fare.ts so the estimate matches what the server charges.
const ROAD_FACTOR = 1.3;
const BASE_FARE = 30;
const BASE_KM = 1.5;
const PER_KM = 11;
const POOL_DISCOUNT = 0.25;

export function estimateFare(pickup: LatLng, drop: LatLng) {
  const km = Math.round(haversineKm(pickup, drop) * ROAD_FACTOR * 100) / 100;
  const solo = Math.round(BASE_FARE + Math.max(0, km - BASE_KM) * PER_KM);
  const pooled = Math.round((BASE_FARE + Math.max(0, km - BASE_KM) * PER_KM) * (1 - POOL_DISCOUNT));
  return { km, solo, pooled };
}

export const inr = (n: number | null | undefined) => `₹${Math.round(n ?? 0)}`;
