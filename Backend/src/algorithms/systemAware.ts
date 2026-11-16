/**
 * System-Aware Ride-Pooling Assignment.
 *
 * TypeScript port of `system_aware_assignment()` (and the helpers it relies on)
 * from Simulation/algorithms.py. The logic mirrors the simulator:
 *
 *   1. Generate several feasible COMPLETE assignment configurations.
 *   2. Evaluate each configuration at the system level.
 *   3. Normalize the features across candidates.
 *   4. Apply the weight profile and choose the minimum-cost configuration.
 *
 * Distances are haversine km instead of the simulator's Euclidean grid units;
 * every threshold in the algorithm is a ratio, so behaviour is scale-free.
 */
import { distance, type Point } from "./geo.ts";

export interface Passenger {
  id: string;
  pickup: Point;
  destination: Point;
  directDistance?: number;
}

export interface Driver {
  id: string;
  location: Point;
  capacity: number;
}

export type Assignment = Array<[Driver, Passenger[]]>;
export type StopEvent = ["pickup" | "dropoff", Passenger];
export type WeightProfile = "Passenger-Focused" | "Balanced" | "System-Focused";
export type Rng = () => number;

/** Hard cap on pool size so route permutations stay cheap (5! * 5! = 14,400). */
export const MAX_POOL_SIZE = 5;

const EPS = 1e-9;

// ----------------------------------------------------------------------------
// Small utilities
// ----------------------------------------------------------------------------

function capacityOf(driver: Driver): number {
  return Math.max(0, Math.min(driver.capacity, MAX_POOL_SIZE));
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((item, i) => {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const p of permutations(rest)) out.push([item, ...p]);
  });
  return out;
}

function combinations2<T>(items: T[]): Array<[T, T]> {
  const out: Array<[T, T]> = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) out.push([items[i]!, items[j]!]);
  }
  return out;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function direct(p: Passenger): number {
  return p.directDistance ?? distance(p.pickup, p.destination);
}

// ----------------------------------------------------------------------------
// Route planning for a pool (all pickups first, then all drop-offs)
// ----------------------------------------------------------------------------

export function bestRouteForPool(
  driver: Driver,
  passengers: Passenger[],
): { route: StopEvent[]; distance: number } {
  if (passengers.length === 0) return { route: [], distance: 0 };

  const orders = permutations(passengers);
  let bestRoute: StopEvent[] = [];
  let bestDistance = Infinity;

  for (const pickupOrder of orders) {
    for (const dropoffOrder of orders) {
      let current = driver.location;
      let total = 0;
      for (const p of pickupOrder) {
        total += distance(current, p.pickup);
        current = p.pickup;
      }
      for (const p of dropoffOrder) {
        total += distance(current, p.destination);
        current = p.destination;
      }
      if (total < bestDistance) {
        bestDistance = total;
        bestRoute = [
          ...pickupOrder.map((p): StopEvent => ["pickup", p]),
          ...dropoffOrder.map((p): StopEvent => ["dropoff", p]),
        ];
      }
    }
  }
  return { route: bestRoute, distance: bestDistance };
}

/** Distance each passenger actually rides along the given route. */
function ridden(driver: Driver, route: StopEvent[], passengers: Passenger[]): Map<string, number> {
  const dist = new Map<string, number>(passengers.map((p) => [p.id, 0]));
  const onboard: Passenger[] = [];
  let current = driver.location;
  for (const [type, p] of route) {
    const target = type === "pickup" ? p.pickup : p.destination;
    const leg = distance(current, target);
    for (const o of onboard) dist.set(o.id, (dist.get(o.id) ?? 0) + leg);
    if (type === "pickup") onboard.push(p);
    else {
      const i = onboard.findIndex((o) => o.id === p.id);
      if (i >= 0) onboard.splice(i, 1);
    }
    current = target;
  }
  return dist;
}

export function isFeasiblePool(driver: Driver, passengers: Passenger[], maxDetourRatio = 0.5): boolean {
  if (passengers.length === 0) return false;
  if (passengers.length > capacityOf(driver)) return false;

  const { route } = bestRouteForPool(driver, passengers);
  if (route.length === 0) return false;

  const dist = ridden(driver, route, passengers);
  for (const p of passengers) {
    const d = direct(p);
    const actual = dist.get(p.id) ?? 0;
    if (d <= EPS) {
      if (actual > EPS) return false;
      continue;
    }
    if ((actual - d) / d > maxDetourRatio) return false;
  }
  return true;
}

export function calculateDetours(driver: Driver, passengers: Passenger[]): Map<string, number> {
  const out = new Map<string, number>();
  if (passengers.length === 0) return out;
  const { route } = bestRouteForPool(driver, passengers);
  const dist = ridden(driver, route, passengers);
  for (const p of passengers) {
    const d = direct(p);
    out.set(p.id, d <= EPS ? 0 : Math.max(0, ((dist.get(p.id) ?? 0) - d) / d));
  }
  return out;
}

// ----------------------------------------------------------------------------
// Candidate generators used inside the System-Aware search
// ----------------------------------------------------------------------------

function nearestDriverInternal(passengers: Passenger[], drivers: Driver[]): Assignment {
  const assignments: Assignment = [];
  const used = new Set<string>();
  for (const p of passengers) {
    let best: Driver | null = null;
    let bestDist = Infinity;
    for (const d of drivers) {
      if (used.has(d.id) || capacityOf(d) <= 0) continue;
      const dd = distance(d.location, p.pickup);
      if (dd < bestDist) {
        bestDist = dd;
        best = d;
      }
    }
    if (best) {
      assignments.push([best, [p]]);
      used.add(best.id);
    }
  }
  return assignments;
}

function greedyPooling(passengers: Passenger[], drivers: Driver[], maxDetour: number): Assignment {
  const assignments: Assignment = [];
  for (const p of passengers) {
    let bestIndex = -1;
    let bestCost = Infinity;
    assignments.forEach(([driver, pool], index) => {
      if (pool.length >= capacityOf(driver)) return;
      if (!isFeasiblePool(driver, [...pool, p], maxDetour)) return;
      const cost = distance(driver.location, p.pickup);
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) {
      const [driver, pool] = assignments[bestIndex]!;
      assignments[bestIndex] = [driver, [...pool, p]];
      continue;
    }

    let best: Driver | null = null;
    let bestDist = Infinity;
    for (const d of drivers) {
      if (assignments.some(([a]) => a.id === d.id)) continue;
      if (capacityOf(d) <= 0) continue;
      const dd = distance(d.location, p.pickup);
      if (dd < bestDist && isFeasiblePool(d, [p], maxDetour)) {
        bestDist = dd;
        best = d;
      }
    }
    if (best) assignments.push([best, [p]]);
  }
  return assignments;
}

function randomFeasibleAssignment(
  passengers: Passenger[],
  drivers: Driver[],
  maxDetour: number,
  rng: Rng,
): Assignment {
  const ps = shuffle(passengers, rng);
  const ds = shuffle(drivers, rng);
  const assignments: Assignment = [];
  for (const p of ps) {
    const feasible: Driver[] = [];
    for (const d of ds) {
      const existing = assignments.find(([a]) => a.id === d.id)?.[1] ?? [];
      const pool = [...existing, p];
      if (pool.length > capacityOf(d)) continue;
      if (isFeasiblePool(d, pool, maxDetour)) feasible.push(d);
    }
    if (feasible.length === 0) continue;
    const chosen = feasible[Math.floor(rng() * feasible.length)]!;
    const idx = assignments.findIndex(([a]) => a.id === chosen.id);
    if (idx >= 0) assignments[idx] = [chosen, [...assignments[idx]![1], p]];
    else assignments.push([chosen, [p]]);
  }
  return assignments;
}

function signature(assignment: Assignment): string {
  return assignment
    .map(([d, ps]) => `${d.id}:${ps.map((p) => p.id).sort().join(",")}`)
    .sort()
    .join("|");
}

function copyAssignment(assignment: Assignment): Assignment {
  return assignment.map(([d, ps]) => [d, ps.slice()]);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function generateCandidateAssignments(
  passengers: Passenger[],
  drivers: Driver[],
  maxDetour = 0.5,
  rng: Rng = Math.random,
): Assignment[] {
  const candidates: Assignment[] = [];
  const seen = new Set<string>();

  const add = (candidate: Assignment) => {
    if (candidate.length === 0) return;
    const sig = signature(candidate);
    if (seen.has(sig)) return;
    seen.add(sig);
    candidates.push(copyAssignment(candidate));
  };

  // 1. nearest driver
  add(nearestDriverInternal(passengers, drivers));
  // 2. greedy pooling
  add(greedyPooling(passengers, drivers, maxDetour));
  // 3. a few random feasible assignments
  for (let i = 0; i < 3; i++) add(randomFeasibleAssignment(passengers, drivers, maxDetour, rng));

  // 4. destination-sorted pooling
  const sorted = passengers
    .slice()
    .sort((a, b) => round2(a.destination[0]) - round2(b.destination[0]) || round2(a.destination[1]) - round2(b.destination[1]));
  const destCandidate: Assignment = [];
  for (const p of sorted) {
    let placed = false;
    for (let i = 0; i < destCandidate.length; i++) {
      const [driver, pool] = destCandidate[i]!;
      if (pool.length >= capacityOf(driver)) continue;
      const next = [...pool, p];
      if (isFeasiblePool(driver, next, maxDetour)) {
        destCandidate[i] = [driver, next];
        placed = true;
        break;
      }
    }
    if (placed) continue;
    let best: Driver | null = null;
    let bestDist = Infinity;
    for (const d of drivers) {
      if (destCandidate.some(([a]) => a.id === d.id)) continue;
      if (!isFeasiblePool(d, [p], maxDetour)) continue;
      const dd = distance(d.location, p.pickup);
      if (dd < bestDist) {
        bestDist = dd;
        best = d;
      }
    }
    if (best) destCandidate.push([best, [p]]);
  }
  add(destCandidate);

  // 5. seeded pairs: close destinations first, then extend greedily
  const pairs = combinations2(passengers)
    .map(([p1, p2]) => ({ d: distance(p1.destination, p2.destination), p1, p2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 20);

  outer: for (const { p1, p2 } of pairs) {
    for (const driver of drivers) {
      if (!isFeasiblePool(driver, [p1, p2], maxDetour)) continue;

      const candidate: Assignment = [[driver, [p1, p2]]];
      const usedPassengers = new Set<string>([p1.id, p2.id]);
      const usedDrivers = new Set<string>([driver.id]);

      for (const p of passengers) {
        if (usedPassengers.has(p.id)) continue;

        let bestIndex = -1;
        let bestCost = Infinity;
        candidate.forEach(([d, pool], index) => {
          if (pool.length >= capacityOf(d)) return;
          if (!isFeasiblePool(d, [...pool, p], maxDetour)) return;
          const cost = distance(d.location, p.pickup);
          if (cost < bestCost) {
            bestCost = cost;
            bestIndex = index;
          }
        });
        if (bestIndex >= 0) {
          const [d, pool] = candidate[bestIndex]!;
          candidate[bestIndex] = [d, [...pool, p]];
          usedPassengers.add(p.id);
          continue;
        }

        let best: Driver | null = null;
        let bestDist = Infinity;
        for (const d of drivers) {
          if (usedDrivers.has(d.id)) continue;
          if (!isFeasiblePool(d, [p], maxDetour)) continue;
          const cost = distance(d.location, p.pickup);
          if (cost < bestDist) {
            bestDist = cost;
            best = d;
          }
        }
        if (best) {
          candidate.push([best, [p]]);
          usedDrivers.add(best.id);
          usedPassengers.add(p.id);
        }
      }

      add(candidate);
      if (candidates.length >= 30) break outer;
    }
  }

  return candidates;
}

// ----------------------------------------------------------------------------
// Evaluation, normalisation and cost
// ----------------------------------------------------------------------------

export interface Features {
  pickup_burden: number;
  route_distance: number;
  detour: number;
  vehicles: number;
  unassigned_ratio: number;
}

const FEATURE_NAMES: Array<keyof Features> = [
  "pickup_burden",
  "route_distance",
  "detour",
  "vehicles",
  "unassigned_ratio",
];

export function evaluateAssignment(assignment: Assignment, allPassengers: Passenger[]): Features {
  let assigned = 0;
  let pickupBurden = 0;
  let routeDistance = 0;
  let detourSum = 0;
  let vehicles = 0;

  for (const [driver, pool] of assignment) {
    if (pool.length === 0) continue;
    vehicles += 1;
    for (const p of pool) {
      assigned += 1;
      pickupBurden += distance(driver.location, p.pickup);
    }
    routeDistance += bestRouteForPool(driver, pool).distance;
    for (const v of calculateDetours(driver, pool).values()) detourSum += v;
  }

  const n = allPassengers.length;
  return {
    pickup_burden: n > 0 ? pickupBurden / n : 0,
    route_distance: routeDistance,
    detour: n > 0 ? detourSum / n : 0,
    vehicles,
    unassigned_ratio: n > 0 ? 1 - assigned / n : 0,
  };
}

export function normalizeFeatures(list: Features[]): Features[] {
  const out = list.map(() => ({}) as Features);
  for (const name of FEATURE_NAMES) {
    const values = list.map((f) => f[name]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    list.forEach((f, i) => {
      out[i]![name] = Math.abs(max - min) < 1e-12 ? 0 : (f[name] - min) / (max - min);
    });
  }
  return out;
}

const WEIGHTS: Record<string, { waiting: number; distance: number; detour: number; vehicles: number }> = {
  "passenger-focused": { waiting: 0.5, distance: 0.1, detour: 0.3, vehicles: 0.1 },
  "system-focused": { waiting: 0.1, distance: 0.4, detour: 0.2, vehicles: 0.3 },
  balanced: { waiting: 0.3, distance: 0.25, detour: 0.25, vehicles: 0.2 },
};

// ----------------------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------------------

export interface PlannedPool {
  driver: Driver;
  passengers: Passenger[];
  /** Optimal stop order for this pool (pickups first, then drop-offs). */
  route: StopEvent[];
  routeDistanceKm: number;
}

/**
 * system_aware_assignment(): returns { driverId: [passenger, ...] }.
 */
export function systemAwareAssignment(
  passengersIn: Passenger[],
  driversIn: Driver[],
  maxDetourRatio = 0.5,
  weightProfile: WeightProfile | string = "Balanced",
  rng: Rng = Math.random,
): Map<string, Passenger[]> {
  const passengers = passengersIn.slice();
  const drivers = driversIn.slice();
  const result = new Map<string, Passenger[]>();
  if (passengers.length === 0 || drivers.length === 0) return result;

  const weights = WEIGHTS[String(weightProfile).trim().toLowerCase()] ?? WEIGHTS["balanced"]!;

  const candidates = generateCandidateAssignments(passengers, drivers, maxDetourRatio, rng);
  if (candidates.length === 0) return result;

  const features = candidates.map((c) => evaluateAssignment(c, passengers));
  const normalized = normalizeFeatures(features);

  let bestIndex = 0;
  let bestCost = Infinity;
  normalized.forEach((n, i) => {
    const cost =
      weights.waiting * n.pickup_burden +
      weights.distance * n.route_distance +
      weights.detour * n.detour +
      weights.vehicles * n.vehicles +
      2.0 * n.unassigned_ratio;
    if (cost < bestCost) {
      bestCost = cost;
      bestIndex = i;
    }
  });

  for (const [driver, pool] of candidates[bestIndex]!) {
    if (pool.length > 0) result.set(driver.id, pool.slice());
  }
  return result;
}

/** Convenience: assignment plus the stop order of each pool, ready to persist. */
export function planSystemAware(
  passengers: Passenger[],
  drivers: Driver[],
  maxDetourRatio = 0.5,
  weightProfile: WeightProfile | string = "Balanced",
  rng: Rng = Math.random,
): PlannedPool[] {
  const assignment = systemAwareAssignment(passengers, drivers, maxDetourRatio, weightProfile, rng);
  const byId = new Map(drivers.map((d) => [d.id, d]));
  const plans: PlannedPool[] = [];
  for (const [driverId, pool] of assignment) {
    const driver = byId.get(driverId);
    if (!driver) continue;
    const { route, distance: km } = bestRouteForPool(driver, pool);
    plans.push({ driver, passengers: pool, route, routeDistanceKm: km });
  }
  return plans;
}
