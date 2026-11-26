import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDriverPlan, rankDriverOptions, type ChoicePassenger, type DriverPlanInput, type DriverPlanSet, type InsertionPlan } from '../src/algorithms/choicePlanner.ts';
import type { Point } from '../src/algorithms/geo.ts';

const pt = (x: number): Point => [0, x / 1000];
const passenger = (id: string, a: number, b: number, onboard = false, addedDelaySeconds = 0): ChoicePassenger => ({ id, pickup: pt(a), destination: pt(b), onboard, addedDelaySeconds });
function input(passengers: ChoicePassenger[] = [], positions = [0, 1, 2, 3, 4]): DriverPlanInput {
  const points = positions.map(pt);
  return { driverId: 'd', location: pt(0), capacity: 5, passengers,
    stops: passengers.flatMap(p => p.onboard ? [{ rideId: p.id, type: 'dropoff' as const, point: p.destination }] : [{ rideId: p.id, type: 'pickup' as const, point: p.pickup }, { rideId: p.id, type: 'dropoff' as const, point: p.destination }]),
    matrix: { points, snappedPoints: points, distances: positions.map(a => positions.map(b => Math.abs(a-b)*100)), durations: positions.map(a => positions.map(b => Math.abs(a-b)*10)), fetchedAt: new Date(0).toISOString() } };
}
const sequence = (p: InsertionPlan) => p.stops.map(s => `${s.rideId}:${s.type}`).join(',');

test('enumerates every feasible insertion while preserving old stop order', () => {
  const result = evaluateDriverPlan(input([passenger('old', 1, 3)]), passenger('__new__', 2, 4), { maxAddedSeconds: 1000, maxInitialDetourRatio: 100 });
  assert.equal(result.insertions.length, 6);
  for (const plan of result.insertions) assert.deepEqual(plan.stops.filter(s => s.rideId === 'old').map(s => s.type), ['pickup','dropoff']);
});
test('90+30 seconds is accepted and 90+31 is rejected without refreshing the budget', () => {
  const state = input([passenger('old', 0, 4, true, 90)]);
  const newcomer = passenger('__new__', 2, 4);
  const signature = '__new__:pickup,old:dropoff,__new__:dropoff';
  const allowed = evaluateDriverPlan(state, newcomer).insertions.find(p => sequence(p) === signature);
  assert.equal(allowed?.delayIncrements.old, 30);
  state.matrix.durations[0]![2] = 21;
  assert.equal(evaluateDriverPlan(state, newcomer).insertions.some(p => sequence(p) === signature), false);
});
test('onboard has no old pickup and its past pickup never contributes burden', () => {
  const state = input([passenger('old', 1, 4, true)], [0, 2, 3, 4]);
  const result = evaluateDriverPlan(state, passenger('__new__', 2, 3));
  assert.equal(result.baseline.pickupBurdenKm, 0);
  assert.ok(result.insertions.length);
  assert.ok(result.insertions.every(p => !p.stops.some(s => s.rideId === 'old' && s.type === 'pickup')));
});
test('conservative reservations block sales even if a dropoff precedes newcomer pickup', () => {
  const state = input([passenger('old', 0, 1, true)]); state.capacity = 1;
  assert.equal(evaluateDriverPlan(state, passenger('__new__', 2, 4)).insertions.length, 0);
});
test('initial distance detour and positive onboard overlap govern feasibility and sharing', () => {
  const result = evaluateDriverPlan(input([passenger('old', 0, 3, true)]), passenger('__new__', 2, 4));
  assert.equal(result.insertions.find(p => sequence(p) === '__new__:pickup,old:dropoff,__new__:dropoff')?.shared, true);
  assert.equal(result.insertions.find(p => sequence(p) === 'old:dropoff,__new__:pickup,__new__:dropoff')?.shared, false);
  const bad = input([passenger('old', 0, 1, true)]);
  assert.equal(evaluateDriverPlan(bad, passenger('__new__', 2, 3)).insertions.some(p => sequence(p) === '__new__:pickup,old:dropoff,__new__:dropoff'), false);
});
test('co-located stops share one dwell and pickup ETA excludes its own dwell', () => {
  const result = evaluateDriverPlan(input([passenger('old', 1, 3)]), passenger('__new__', 1, 4));
  const plan = result.insertions.find(p => sequence(p) === 'old:pickup,__new__:pickup,old:dropoff,__new__:dropoff')!;
  assert.equal(plan.pickupEtaSeconds, 10);
  assert.equal(plan.delayIncrements.old, 0);
});
test('directed distances and times are used, unreachable legs never become guesses', () => {
  const state = input(); state.matrix.durations[0]![2] = 123; state.matrix.distances[0]![2] = 777;
  const plan = evaluateDriverPlan(state, passenger('__new__', 2, 4)).insertions[0]!;
  assert.equal(plan.pickupEtaSeconds, 123); assert.equal(plan.routeDistanceMeters, 977);
  state.matrix.durations[2]![4] = Infinity;
  assert.equal(evaluateDriverPlan(state, passenger('__new__', 2, 4)).insertions.length, 0);
});
test('rejects inconsistent stop plans, missing matrix points, and invalid capacity', () => {
  const state = input([passenger('old', 1, 3)]); state.stops.reverse();
  assert.throws(() => evaluateDriverPlan(state, passenger('__new__', 2, 4)), /stop/i);
  assert.throws(() => evaluateDriverPlan(input([], [0, 1]), passenger('__new__', 2, 4)), /matrix/i);
  const bad = input(); bad.capacity = 0;
  assert.throws(() => evaluateDriverPlan(bad, passenger('__new__', 2, 4)), /capacity/i);
});
test('zero direct trips and nonzero remaining travel with zero onboard direct are rejected', () => {
  assert.equal(evaluateDriverPlan(input(), passenger('__new__', 2, 2)).insertions.length, 0);
  const state = input([passenger('old', 0, 0, true)]);
  const result = evaluateDriverPlan(state, passenger('__new__', 1, 2));
  assert.ok(result.insertions.every(p => p.stops[0]?.rideId === 'old'));
});
test('rounds added delay conservatively but ignores floating point noise', () => {
  const state = input([passenger('old', 0, 4, true, 90)]);
  state.matrix.durations[0]![2] = 20 + 1e-12;
  assert.ok(evaluateDriverPlan(state, passenger('__new__', 2, 4)).insertions.some(p => p.delayIncrements.old === 30));
  state.matrix.durations[0]![2] = 20.01;
  assert.ok(!evaluateDriverPlan(state, passenger('__new__', 2, 4)).insertions.some(p => sequence(p) === '__new__:pickup,old:dropoff,__new__:dropoff'));
});
test('ranks globally normalized insertions then one per driver, with deterministic top four', () => {
  const sets = ['e','d','c','b','a'].map(id => ({ ...evaluateDriverPlan({ ...input(), driverId: id }, passenger('__new__', 2, 4)), rating: id === 'e' ? 5 : 1 }));
  const result = rankDriverOptions(sets);
  assert.deepEqual(result.map(p => p.driverId), ['a','b','c','d']);
  assert.deepEqual(result.map(p => p.recommended), [true,false,false,false]);
  assert.deepEqual(rankDriverOptions([]), []);
});
test('ranking retains all other drivers committed work and normalizes before driver minimum', () => {
  const make = (driverId: string, pickupBurdenKm: number, routeDistanceKm: number, detourSum: number): InsertionPlan => ({ driverId, stops: [], delayIncrements: {}, pickupEtaSeconds: 0, routeDistanceMeters: 0, directDistanceMeters: 1, shared: false, features: {pickupBurdenKm, routeDistanceKm, detourSum, vehicles: 1, passengerCount: 2} });
  const baseline = { pickupBurdenKm: 0, routeDistanceKm: 0, detourSum: 0, vehicles: 1, passengerCount: 1 };
  const sets: DriverPlanSet[] = [{driverId:'a',baseline,insertions:[make('a',0,10,0),make('a',1000,0,0)]},{driverId:'b',baseline,insertions:[make('b',1,1,0)]}];
  const result = rankDriverOptions(sets);
  assert.equal(result[0]?.driverId, 'b');
  assert.equal(result[1]?.features.routeDistanceKm, 10);
  assert.ok(Math.abs(result[0]!.score - (0.3*0.001 + 0.25*0.1)) < 1e-9);
});
test('existing distant committed work remains in every candidate fleet snapshot', () => {
  const active = evaluateDriverPlan(input([passenger('old', 1, 3)]), passenger('__new__', 2, 4));
  const idle = evaluateDriverPlan({...input(), driverId:'idle'}, passenger('__new__', 2, 4));
  active.baseline.routeDistanceKm = 100;
  active.insertions = [{...active.insertions[0]!, features:{pickupBurdenKm:0, routeDistanceKm:110,detourSum:0,vehicles:1,passengerCount:2}}];
  idle.insertions = [{...idle.insertions[0]!,features:{pickupBurdenKm:0, routeDistanceKm:20,detourSum:0,vehicles:1,passengerCount:1}}];
  active.baseline.pickupBurdenKm = 0; active.baseline.detourSum = 0;
  const result = rankDriverOptions([idle,active]);
  assert.deepEqual(result.map(p => p.driverId), ['d','idle']);
  assert.equal(result[0]!.score, 0);
  assert.equal(result[1]!.score, 0.45);
});
test('zero-distance simultaneous riders do not qualify as shared', () => {
  const result = evaluateDriverPlan(input([passenger('old',0,2,true)]), passenger('__new__',2,4));
  assert.equal(result.insertions.find(p => sequence(p) === '__new__:pickup,old:dropoff,__new__:dropoff')?.shared,false);
});
test('duplicate matrix points and caller-owned state are preserved', () => {
  const state = input([passenger('old',1,3)], [0,1,2,2,3,4]);
  const before = JSON.stringify(state);
  const result = evaluateDriverPlan(state, passenger('__new__',2,4));
  assert.ok(result.insertions.length);
  result.insertions[0]!.stops[0]!.point[0] = 42;
  assert.equal(JSON.stringify(state),before);
});
test('unreachable committed work fails the whole snapshot closed', () => {
  const state = input([passenger('old',1,3)]);
  state.matrix.durations[1]![3] = Infinity;
  const broken = evaluateDriverPlan(state,passenger('__new__',2,4));
  assert.equal(broken.insertions.length,0);
  assert.deepEqual(rankDriverOptions([broken,evaluateDriverPlan({...input(),driverId:'idle'},passenger('__new__',2,4))]),[]);
});
