// Geo helpers used by the matching algorithm and route snapping.
// All distances are in kilometres.

export type Point = [number, number]; // [lat, lng]

const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Haversine distance between two [lat, lng] points, in km. */
export function distance(a: Point, b: Point): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a[0])) * Math.cos(toRad(b[0]));
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Closest point on segment a-b to p (local flat approximation, fine for city scale).
 * Returns the snapped point and its distance from p in km.
 */
export function snapToSegment(p: Point, a: Point, b: Point): { point: Point; km: number } {
  const kx = Math.cos(toRad(p[0]));
  const ax = a[1] * kx, ay = a[0];
  const bx = b[1] * kx, by = b[0];
  const px = p[1] * kx, py = p[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { point, km: distance(p, point) };
}

/** Closest point on a polyline (ordered points) to p. */
export function snapToPolyline(p: Point, line: Point[]): { point: Point; km: number } | null {
  if (line.length === 0) return null;
  const first = line[0] as Point;
  if (line.length === 1) return { point: first, km: distance(p, first) };
  let best: { point: Point; km: number } | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const s = snapToSegment(p, line[i] as Point, line[i + 1] as Point);
    if (!best || s.km < best.km) best = s;
  }
  return best;
}
