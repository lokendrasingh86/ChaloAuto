import { distance, type Point } from "../algorithms/geo.ts";

// Delhi-style auto fare: minimum fare covers the first stretch, then a per-km rate.
export const ROAD_FACTOR = 1.3; // straight-line km -> approximate road km
export const BASE_FARE = 30; // INR
export const BASE_KM = 1.5;
export const PER_KM = 11; // INR per km after BASE_KM
export const POOL_DISCOUNT = 0.25; // 25% off when sharing with another passenger

export interface FareQuote {
  distanceKm: number;
  fare: number;
  pooled: boolean;
}

export function tripDistanceKm(pickup: Point, drop: Point): number {
  return Math.round(distance(pickup, drop) * ROAD_FACTOR * 100) / 100;
}

export function calculateFare(distanceKm: number, poolSize = 1): FareQuote {
  const raw = BASE_FARE + Math.max(0, distanceKm - BASE_KM) * PER_KM;
  const pooled = poolSize > 1;
  const fare = Math.round(pooled ? raw * (1 - POOL_DISCOUNT) : raw);
  return { distanceKm, fare, pooled };
}
