import { distance, type Point } from './geo.ts';
import { normalizeFeatures, WEIGHTS } from './systemAware.ts';
import type { RoadMatrix } from '../services/road-routing.ts';

export interface ChoiceStop { rideId: string; type: 'pickup' | 'dropoff'; point: Point }
export interface ChoicePassenger { id: string; pickup: Point; destination: Point; onboard: boolean; addedDelaySeconds: number }
export interface DriverPlanInput { driverId: string; location: Point; capacity: number; passengers: ChoicePassenger[]; stops: ChoiceStop[]; matrix: RoadMatrix }
export interface FeatureSums { pickupBurdenKm: number; routeDistanceKm: number; detourSum: number; vehicles: number; passengerCount: number }
export interface InsertionPlan { driverId: string; stops: ChoiceStop[]; delayIncrements: Record<string, number>; pickupEtaSeconds: number; routeDistanceMeters: number; directDistanceMeters: number; shared: boolean; features: FeatureSums }
export interface DriverPlanSet { driverId: string; baseline: FeatureSums; insertions: InsertionPlan[] }
export interface RankedInsertion extends InsertionPlan { score: number; recommended: boolean }

const EPS = 1e-9;
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
function validPoint(p: Point): boolean {
  return Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
}
function blank(passengerCount: number): FeatureSums {
  return { pickupBurdenKm: 0, routeDistanceKm: 0, detourSum: 0, vehicles: passengerCount ? 1 : 0, passengerCount };
}

/** Exhaustive insertion into a fixed remaining order. No travel estimates are inferred. */
export function evaluateDriverPlan(input: DriverPlanInput, newcomer: ChoicePassenger, options: { maxAddedSeconds?: number; maxInitialDetourRatio?: number; dwellSeconds?: number } = {}): DriverPlanSet {
  const maxAdded = options.maxAddedSeconds ?? 120;
  const maxDetour = options.maxInitialDetourRatio ?? 0.5;
  const dwell = options.dwellSeconds ?? 30;
  if (![maxAdded, maxDetour, dwell].every(n => Number.isFinite(n) && n >= 0)) throw new TypeError('Invalid planner limits');
  if (!input.driverId || !Number.isInteger(input.capacity) || input.capacity <= 0) throw new TypeError('Invalid driver capacity');
  const matrix = input.matrix;
  const count = matrix.points.length;
  if (!count || matrix.snappedPoints.length !== count || matrix.distances.length !== count || matrix.durations.length !== count ||
    !Number.isFinite(Date.parse(matrix.fetchedAt)) || !matrix.points.every(validPoint) || !matrix.snappedPoints.every(validPoint) ||
    !matrix.distances.every(row => Array.isArray(row) && row.length === count) || !matrix.durations.every(row => Array.isArray(row) && row.length === count)) throw new TypeError('Invalid road matrix');
  if (matrix.points.some((p, i) => distance(p, matrix.snappedPoints[i]!) * 1000 > 25 + EPS)) throw new TypeError('Road matrix snap exceeds 25 metres');
  const index = (p: Point): number => {
    if (!validPoint(p)) throw new TypeError('Invalid point in matrix input');
    const i = matrix.points.findIndex(q => same(q, p));
    if (i < 0) throw new TypeError('Required point missing from road matrix');
    return i;
  };
  index(input.location);
  const people = new Map<string, ChoicePassenger>();
  for (const p of [...input.passengers, newcomer]) {
    if (!p.id || people.has(p.id) || typeof p.onboard !== 'boolean' || !Number.isFinite(p.addedDelaySeconds) || p.addedDelaySeconds < 0) throw new TypeError('Invalid or duplicate passenger');
    // Historical pickups of onboard riders are deliberately not required in the matrix.
    if (!p.onboard) index(p.pickup);
    else if (!validPoint(p.pickup)) throw new TypeError('Invalid historical pickup');
    index(p.destination);
    people.set(p.id, p);
  }
  if (newcomer.onboard || newcomer.addedDelaySeconds !== 0) throw new TypeError('New passenger must be waiting with zero consumed delay');
  const seenPickup = new Set<string>();
  const seenDropoff = new Set<string>();
  for (const stop of input.stops) {
    const p = people.get(stop.rideId);
    if (!p || p.id === newcomer.id || !['pickup', 'dropoff'].includes(stop.type)) throw new TypeError('Unknown passenger in stop plan');
    index(stop.point);
    if (stop.type === 'pickup') {
      if (p.onboard || seenPickup.has(p.id) || seenDropoff.has(p.id) || !same(stop.point, p.pickup)) throw new TypeError('Invalid pickup stop order');
      seenPickup.add(p.id);
    } else {
      if (seenDropoff.has(p.id) || (!p.onboard && !seenPickup.has(p.id)) || !same(stop.point, p.destination)) throw new TypeError('Invalid dropoff stop order');
      seenDropoff.add(p.id);
    }
  }
  if (input.passengers.some(p => !seenDropoff.has(p.id) || (!p.onboard && !seenPickup.has(p.id)))) throw new TypeError('Missing remaining stop');
  const leg = (from: Point, to: Point): { meters: number; seconds: number } | null => {
    const i = index(from), j = index(to);
    const meters = matrix.distances[i]![j]!, seconds = matrix.durations[i]![j]!;
    if (!Number.isFinite(meters) || !Number.isFinite(seconds) || meters < 0 || seconds < 0) return null;
    // A repeated coordinate is the same physical visit, regardless of its matrix index.
    if (same(from, to) && (meters > EPS || seconds > EPS)) return null;
    return { meters, seconds };
  };
  interface Measured { features: FeatureSums; dropTimes: Map<string, number>; pickupTimes: Map<string, number>; ridden: Map<string, number>; shared: boolean }
  const measure = (stops: ChoiceStop[], passengers: ChoicePassenger[]): Measured | null => {
    let current = input.location, meters = 0, seconds = 0, shared = false;
    const onboard = new Set(passengers.filter(p => p.onboard).map(p => p.id));
    const pickupMeters = new Map(passengers.filter(p => p.onboard).map(p => [p.id, 0]));
    const ridden = new Map<string, number>(), pickupTimes = new Map<string, number>(), dropTimes = new Map<string, number>();
    const features = blank(passengers.length);
    for (let i = 0; i < stops.length;) {
      const target = stops[i]!.point, travel = leg(current, target);
      if (!travel) return null;
      if (travel.meters > EPS && onboard.has(newcomer.id) && onboard.size > 1) shared = true;
      meters += travel.meters; seconds += travel.seconds;
      // All consecutive events at one physical location share an arrival and dwell.
      let j = i;
      while (j < stops.length && same(stops[j]!.point, target)) {
        const stop = stops[j]!;
        if (stop.type === 'pickup') {
          pickupMeters.set(stop.rideId, meters); pickupTimes.set(stop.rideId, seconds);
          features.pickupBurdenKm += meters / 1000; onboard.add(stop.rideId);
        } else {
          ridden.set(stop.rideId, meters - (pickupMeters.get(stop.rideId) ?? 0));
          dropTimes.set(stop.rideId, seconds); onboard.delete(stop.rideId);
        }
        j++;
      }
      seconds += dwell; current = target; i = j;
    }
    features.routeDistanceKm = meters / 1000;
    for (const p of passengers) {
      const direct = leg(p.onboard ? input.location : p.pickup, p.destination);
      if (!direct) return null;
      const actual = ridden.get(p.id)!;
      if (direct.meters <= EPS) { if (actual > EPS) return null; }
      else features.detourSum += Math.max(0, (actual - direct.meters) / direct.meters);
    }
    return { features, dropTimes, pickupTimes, ridden, shared };
  };
  const baseline = measure(input.stops, input.passengers);
  // An unmeasurable committed plan cannot safely participate in a fleet snapshot.
  const result: DriverPlanSet = { driverId: input.driverId, baseline: baseline?.features ?? { ...blank(input.passengers.length), routeDistanceKm: Infinity }, insertions: [] };
  const direct = leg(newcomer.pickup, newcomer.destination);
  if (!baseline || !direct || direct.meters <= EPS || input.passengers.length + 1 > input.capacity || input.passengers.some(p => p.addedDelaySeconds > maxAdded)) return result;
  const pickup: ChoiceStop = { rideId: newcomer.id, type: 'pickup', point: [...newcomer.pickup] };
  const dropoff: ChoiceStop = { rideId: newcomer.id, type: 'dropoff', point: [...newcomer.destination] };
  for (let i = 0; i <= input.stops.length; i++) {
    const withPickup = [...input.stops.slice(0, i), pickup, ...input.stops.slice(i)];
    for (let j = i + 1; j <= withPickup.length; j++) {
      const stops = [...withPickup.slice(0, j), dropoff, ...withPickup.slice(j)];
      const measured = measure(stops, [...input.passengers, newcomer]);
      if (!measured || measured.ridden.get(newcomer.id)! > direct.meters * (1 + maxDetour) + EPS) continue;
      const delayIncrements: Record<string, number> = Object.create(null) as Record<string, number>;
      let feasible = true;
      for (const p of input.passengers) {
        const extra = Math.max(0, measured.dropTimes.get(p.id)! - baseline.dropTimes.get(p.id)!);
        const increment = Math.max(0, Math.ceil(extra - EPS));
        delayIncrements[p.id] = increment;
        if (p.addedDelaySeconds + increment > maxAdded + EPS) feasible = false;
      }
      if (feasible) result.insertions.push({ driverId: input.driverId, stops: stops.map(s => ({ ...s, point: [...s.point] })), delayIncrements,
        pickupEtaSeconds: measured.pickupTimes.get(newcomer.id)!, routeDistanceMeters: measured.features.routeDistanceKm * 1000,
        directDistanceMeters: direct.meters, shared: measured.shared, features: measured.features });
    }
  }
  return result;
}

/** Score every fleet snapshot together before choosing each driver's best ordering. */
export function rankDriverOptions(sets: DriverPlanSet[], limit = 4): RankedInsertion[] {
  if (!Number.isInteger(limit) || limit < 0) throw new TypeError('Invalid option limit');
  if (new Set(sets.map(s => s.driverId)).size !== sets.length) throw new TypeError('Duplicate driver plan set');
  const totals = blank(0);
  for (const set of sets) {
    if (!Object.values(set.baseline).every(Number.isFinite)) return [];
    for (const key of Object.keys(totals) as Array<keyof FeatureSums>) totals[key] += set.baseline[key];
  }
  const candidates = sets.flatMap(set => set.insertions.map((plan, order) => {
    const fleet = { ...totals };
    for (const key of Object.keys(fleet) as Array<keyof FeatureSums>) fleet[key] += plan.features[key] - set.baseline[key];
    return { plan, order, fleet };
  }));
  if (!candidates.length || limit === 0) return [];
  const normalized = normalizeFeatures(candidates.map(({ fleet }) => ({
    pickup_burden: fleet.passengerCount ? fleet.pickupBurdenKm / fleet.passengerCount : 0,
    route_distance: fleet.routeDistanceKm,
    detour: fleet.passengerCount ? fleet.detourSum / fleet.passengerCount : 0,
    vehicles: fleet.vehicles, unassigned_ratio: 0,
  })));
  const weights = WEIGHTS.balanced!;
  const ranked = candidates.map(({ plan, order }, i) => {
    const f = normalized[i]!;
    return { plan, order, score: weights.waiting * f.pickup_burden + weights.distance * f.route_distance + weights.detour * f.detour + weights.vehicles * f.vehicles + 2 * f.unassigned_ratio };
  }).sort((a, b) => a.score - b.score || (a.plan.driverId < b.plan.driverId ? -1 : a.plan.driverId > b.plan.driverId ? 1 : 0) || a.order - b.order);
  const selected: RankedInsertion[] = [], seen = new Set<string>();
  for (const { plan, score } of ranked) {
    if (seen.has(plan.driverId)) continue;
    seen.add(plan.driverId); selected.push({ ...plan, score, recommended: selected.length === 0 });
    if (selected.length >= Math.min(limit, 4)) break;
  }
  return selected;
}
