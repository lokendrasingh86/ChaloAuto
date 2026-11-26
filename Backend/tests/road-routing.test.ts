import test from 'node:test';
import assert from 'node:assert/strict';
import { OsrmRouter, RoutingUnavailable } from '../src/services/road-routing.ts';
import type { Point } from '../src/algorithms/geo.ts';

const points: Point[] = [[12, 77], [12.01, 77.02], [12, 77]];
const waypoints = points.map(([lat, lng]) => ({ location: [lng + 0.001, lat], distance: 100, name: 'road' }));
const table = () => ({ code: 'Ok', sources: waypoints, destinations: waypoints,
  distances: [[0, 1200, 0], [1700, 0, 1700], [0, 1200, 0]],
  durations: [[0, 125, 0], [180, 0, 180], [0, 125, 0]] });
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const router = (fetcher: typeof fetch, extra = {}) => new OsrmRouter({ baseUrl: 'https://synthetic.invalid', fetcher, minIntervalMs: 0, timeoutMs: 500, ...extra });

test('table preserves original and duplicate indices, directed metres/seconds and provider snaps', async () => {
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/table/v1/driving/77,12;77.02,12.01;77,12');
    assert.equal(url.searchParams.get('annotations'), 'distance,duration');
    assert.equal(url.searchParams.has('fallback_speed'), false);
    assert.match(new Headers(init?.headers).get('User-Agent') ?? '', /ChaloAuto/);
    return response(table());
  };
  const result = await router(fetcher).matrix(points);
  assert.deepEqual(result.points, points);
  assert.deepEqual(result.snappedPoints, [[12, 77.001], [12.01, 77.021], [12, 77.001]]);
  assert.equal(result.distances[0]?.[1], 1200);
  assert.equal(result.distances[1]?.[0], 1700);
  assert.equal(result.durations[1]?.[0], 180);
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
});

test('route requests full GeoJSON and converts longitude latitude geometry to Point', async () => {
  const result = await router(async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get('overview'), 'full');
    assert.equal(url.searchParams.get('geometries'), 'geojson');
    assert.equal(url.searchParams.get('annotations'), 'distance,duration');
    return response({ code: 'Ok', waypoints, routes: [{ distance: 3000, duration: 305,
      geometry: { type: 'LineString', coordinates: [[77.001, 12], [77.01, 12.005], [77.001, 12]] } }] });
  }).route(points);
  assert.deepEqual(result.geometry, [[12, 77.001], [12.005, 77.01], [12, 77.001]]);
  assert.deepEqual(result.points, points);
  assert.equal(result.distanceMeters, 3000);
  assert.equal(result.durationSeconds, 305);
});

test('unreachable, malformed, negative and nonfinite matrix cells fail closed', async () => {
  for (const field of ['durations', 'distances'] as const) {
    for (const value of [null, -1, '12', Infinity]) {
      const body = table();
      (body[field][0] as unknown[])[1] = value;
      await assert.rejects(router(async () => response(body)).matrix(points), RoutingUnavailable);
    }
  }
  for (const body of [{ ...table(), distances: [[0]] }, { ...table(), sources: [] },
    { ...table(), destinations: [{ location: [181, 12] }, ...waypoints.slice(1)] }, { code: 'NoTable' }]) {
    await assert.rejects(router(async () => response(body)).matrix(points), RoutingUnavailable);
  }
});

test('bad route metrics, missing geometry, failed HTTP and malformed JSON fail closed', async () => {
  for (const route of [{ distance: null, duration: 10 }, { distance: 10, duration: -1 },
    { distance: 10, duration: 10, geometry: { type: 'LineString', coordinates: [[77, 12], [77, null]] } }]) {
    await assert.rejects(router(async () => response({ code: 'Ok', waypoints, routes: [route] })).route(points), RoutingUnavailable);
  }
  await assert.rejects(router(async () => new Response('down', { status: 503 })).matrix(points), RoutingUnavailable);
  await assert.rejects(router(async () => new Response('{')).matrix(points), RoutingUnavailable);
});

test('coalesces across instances, caches results and protects cache from caller mutation', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return response(table()); };
  const a = router(fetcher), b = router(fetcher);
  const [first, second] = await Promise.all([a.matrix(points), b.matrix(points)]);
  assert.equal(calls, 1);
  first.distances[0]![1] = 999;
  second.points[0]![0] = 0;
  const cached = await b.matrix(points);
  assert.equal(calls, 1);
  assert.equal(cached.distances[0]?.[1], 1200);
  assert.deepEqual(cached.points, points);
});

test('cache expires and failed fetches can be retried', async () => {
  let calls = 0;
  const client = router(async () => { calls++; if (calls === 1) throw new Error('offline'); return response(table()); }, { cacheTtlMs: 15 });
  await assert.rejects(client.matrix(points), RoutingUnavailable);
  await client.matrix(points);
  await new Promise(resolve => setTimeout(resolve, 25));
  await client.matrix(points);
  assert.equal(calls, 3);
});

test('serializes requests globally and spaces different requests across router instances', async () => {
  const starts: number[] = [];
  let active = 0, maximum = 0;
  const fetcher: typeof fetch = async () => {
    starts.push(Date.now()); maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 15)); active--;
    return response(table());
  };
  await Promise.all([router(fetcher, { minIntervalMs: 60 }).matrix(points),
    router(fetcher, { minIntervalMs: 60 }).matrix([...points].reverse().map(([lat, lng]) => [lat + 0.001, lng]))]);
  assert.equal(maximum, 1);
  assert.ok(starts[1]! - starts[0]! >= 55);
});

test('deadline bounds stalled fetches and queued requests, and expired queued work never fetches', async () => {
  let started = 0;
  const fetcher: typeof fetch = async () => { started++; return new Promise(() => {}); };
  const start = Date.now();
  await Promise.all([assert.rejects(router(fetcher, { timeoutMs: 80 }).matrix(points), RoutingUnavailable),
    assert.rejects(router(fetcher, { timeoutMs: 25 }).route(points), RoutingUnavailable)]);
  assert.ok(Date.now() - start < 300);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(started, 1);
});

test('default queue interval is one second across separate providers', async () => {
  const starts: number[] = [];
  const first = new OsrmRouter({ fetcher: async () => { starts.push(Date.now()); return response(table()); }, timeoutMs: 2500 });
  const second = new OsrmRouter({ fetcher: async () => { starts.push(Date.now()); return response(table()); }, timeoutMs: 2500 });
  await Promise.all([first.matrix(points), second.matrix(points)]);
  assert.ok(starts[1]! - starts[0]! >= 990);
});

test('timeout includes response decoding and aborts the provider', async () => {
  let signal: AbortSignal | undefined;
  const client = router(async (_input, init) => {
    signal = init?.signal as AbortSignal;
    const result = response(table());
    result.json = () => new Promise(() => {});
    return result;
  }, { timeoutMs: 40 });
  // The preceding provider's default interval also consumes this request's
  // budget; use enough time to reach this provider and then bound JSON decoding.
  await new Promise(resolve => setTimeout(resolve, 1010));
  await assert.rejects(client.matrix(points), RoutingUnavailable);
  assert.equal(signal?.aborted, true);
});

test('invalid input never reaches provider', async () => {
  let calls = 0;
  const client = router(async () => { calls++; return response(table()); });
  for (const invalid of [[], [[91, 77]], [[12, NaN]]]) {
    await assert.rejects(client.matrix(invalid as Point[]), RoutingUnavailable);
  }
  assert.equal(calls, 0);
});
