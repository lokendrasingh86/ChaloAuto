import type { Point } from '../algorithms/geo.ts';

export interface RoadMatrix { points: Point[]; snappedPoints: Point[]; distances: number[][]; durations: number[][]; fetchedAt: string }
export interface RoadRoute { points: Point[]; snappedPoints: Point[]; geometry: Point[]; distanceMeters: number; durationSeconds: number; fetchedAt: string }
export interface RoadRouter { matrix(points: Point[]): Promise<RoadMatrix>; route(points: Point[]): Promise<RoadRoute> }
export class RoutingUnavailable extends Error {
  constructor(message = 'Road routing is unavailable') { super(message); this.name = 'RoutingUnavailable'; }
}
type RouterOptions = { baseUrl?: string; fetcher?: typeof fetch; minIntervalMs?: number; cacheTtlMs?: number; timeoutMs?: number };

// The public demo is suitable only for light educational use. Applications must
// display "© OpenStreetMap contributors · Routing: OSRM" with links to
// https://www.openstreetmap.org/copyright and https://project-osrm.org/.
// There is no traffic model, fallback speed, or geometric estimate here.
let queue: Promise<void> = Promise.resolve();
let lastStarted = 0;
let lastInterval = 0;
const fetcherIds = new WeakMap<typeof fetch, number>();
let nextFetcherId = 1;
type Result = RoadMatrix | RoadRoute;
const cache = new Map<string, { value: Result; at: number }>();
const inFlight = new Map<string, Promise<Result>>();

const fail = (): never => { throw new RoutingUnavailable('Invalid or unreachable road estimate'); };
function coordinate(value: unknown): Point {
  if (!Array.isArray(value) || value.length !== 2 ||
    !value.every(n => typeof n === 'number' && Number.isFinite(n)) ||
    Math.abs(value[0]) > 180 || Math.abs(value[1]) > 90) return fail();
  return [value[1], value[0]];
}
function waypoints(value: unknown, count: number): Point[] {
  if (!Array.isArray(value) || value.length !== count) return fail();
  return value.map(item => coordinate(item?.location));
}
function metric(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fail();
  return value;
}
function cells(value: unknown, count: number): number[][] {
  if (!Array.isArray(value) || value.length !== count) return fail();
  return value.map(row => {
    if (!Array.isArray(row) || row.length !== count) return fail();
    return row.map(metric);
  });
}
function bounded<T>(work: Promise<T>, timeoutMs: number, controller?: AbortController): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      controller?.abort(); reject(new RoutingUnavailable('Road routing timed out'));
    }, timeoutMs);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export class OsrmRouter implements RoadRouter {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly interval: number;
  private readonly ttl: number;
  private readonly timeout: number;
  private readonly providerKey: string;

  constructor(options: RouterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org').replace(/\/$/, '');
    this.fetcher = options.fetcher ?? fetch;
    this.interval = Math.max(this.fetcher === fetch ? 1000 : 0, options.minIntervalMs ?? 1000);
    this.ttl = options.cacheTtlMs ?? 300_000;
    this.timeout = options.timeoutMs ?? 10_000;
    if (![this.interval, this.ttl, this.timeout].every(Number.isFinite) || this.ttl < 0 || this.timeout <= 0) {
      throw new RoutingUnavailable('Invalid routing configuration');
    }
    const url = new URL(this.baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new RoutingUnavailable('Invalid routing URL');
    if (!fetcherIds.has(this.fetcher)) fetcherIds.set(this.fetcher, nextFetcherId++);
    this.providerKey = `${fetcherIds.get(this.fetcher)}:${this.baseUrl}`;
  }

  matrix(points: Point[]): Promise<RoadMatrix> { return this.request('table', points) as Promise<RoadMatrix>; }
  route(points: Point[]): Promise<RoadRoute> { return this.request('route', points) as Promise<RoadRoute>; }

  private async request(kind: 'table' | 'route', input: Point[]): Promise<Result> {
    if (!Array.isArray(input) || input.length < 2) return fail();
    const points = input.map(p => {
      if (!Array.isArray(p) || p.length !== 2) return fail();
      return coordinate([p[1], p[0]]);
    });
    const key = `${this.providerKey}:${kind}:${JSON.stringify(points)}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < this.ttl) return structuredClone(cached.value);
    let pending = inFlight.get(key);
    if (!pending) {
      const controller = new AbortController();
      const deadline = Date.now() + this.timeout;
      const scheduled = queue.then(async () => {
        if (controller.signal.aborted) throw new RoutingUnavailable('Road routing timed out');
        const delay = Math.max(0, lastStarted + Math.max(this.interval, lastInterval) - Date.now());
        if (delay >= deadline - Date.now()) throw new RoutingUnavailable('Road routing timed out in queue');
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        if (controller.signal.aborted || Date.now() >= deadline) throw new RoutingUnavailable('Road routing timed out');
        lastStarted = Date.now(); lastInterval = this.interval;
        return bounded(this.load(kind, points, controller.signal), Math.max(1, deadline - Date.now()), controller);
      });
      // A timed-out caller must not leave a stalled provider blocking the queue.
      queue = scheduled.then(() => {}, () => {});
      pending = bounded(scheduled, this.timeout, controller).then(value => {
        cache.delete(key);
        cache.set(key, { value, at: Date.now() });
        if (cache.size > 512) cache.delete(cache.keys().next().value!);
        return value;
      }).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    try { return structuredClone(await bounded(pending, this.timeout)); }
    catch (error) {
      if (error instanceof RoutingUnavailable) throw error;
      throw new RoutingUnavailable('Road routing provider failed');
    }
  }

  private async load(kind: 'table' | 'route', points: Point[], signal: AbortSignal): Promise<Result> {
    const coordinates = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url = new URL(`${this.baseUrl}/${kind}/v1/driving/${coordinates}`);
    url.searchParams.set('annotations', 'distance,duration');
    if (kind === 'route') {
      url.searchParams.set('overview', 'full');
      url.searchParams.set('geometries', 'geojson');
      url.searchParams.set('alternatives', 'false');
      url.searchParams.set('steps', 'false');
    }
    const response = await this.fetcher(url.toString(), {
      signal, headers: { 'User-Agent': 'ChaloAuto/1.0 (educational rideshare demo)', Accept: 'application/json' },
    });
    if (!response.ok) throw new RoutingUnavailable('Road routing provider failed');
    const body = await response.json() as Record<string, any>;
    if (!body || body.code !== 'Ok') return fail();
    const fetchedAt = new Date().toISOString();
    if (kind === 'table') {
      const snappedPoints = waypoints(body.sources, points.length);
      const destinations = waypoints(body.destinations, points.length);
      if (JSON.stringify(snappedPoints) !== JSON.stringify(destinations)) return fail();
      return { points, snappedPoints, distances: cells(body.distances, points.length), durations: cells(body.durations, points.length), fetchedAt };
    }
    const snappedPoints = waypoints(body.waypoints, points.length);
    const route = body.routes?.[0];
    if (!route || route.geometry?.type !== 'LineString' ||
      !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2) return fail();
    return { points, snappedPoints, geometry: route.geometry.coordinates.map(coordinate),
      distanceMeters: metric(route.distance), durationSeconds: metric(route.duration), fetchedAt };
  }
}
export const roadRouter: RoadRouter = new OsrmRouter();
