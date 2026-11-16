import { prisma } from "../lib/prisma.ts";
import { distance as haversine, snapToPolyline, type Point } from "../algorithms/geo.ts";


function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  let dlat = (b.latitude - a.latitude) * Math.PI / 180;
  let dlon = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;

  let x =
    Math.sin(dlat / 2) * Math.sin(dlat / 2) +
    Math.sin(dlon / 2) * Math.sin(dlon / 2) * Math.cos(lat1) * Math.cos(lat2);
  let c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  let R = 6371;
  return R * c;
}

export const findNearestRoutePoint = async (
  passengerLat: number,
  passengerLng: number
) => {
  const points = await prisma.routePoint.findMany();
  let minDistance = Infinity;
  let bestPoint = null;

  for (const point of points) {
    const calculatedDistance = distance(
      { latitude: passengerLat, longitude: passengerLng },
      { latitude: point.lat, longitude: point.lng }
    );
    if (calculatedDistance < minDistance) {
      minDistance = calculatedDistance;
      bestPoint = point;
    }
  }
  if (minDistance > 1) {
    throw new Error("No nearby route points found");
  }
  if (!bestPoint) {
    throw new Error("No route points available");
  }
  return bestPoint;
};

export const getAllRoutesList = async () => {
  return await prisma.route.findMany({
    include: { points: { orderBy: { sequence: "asc" } } },
  });
};

export const MAX_SNAP_KM = 1;

export interface TripRoute {
  routeId: string;
  routeName: string;
  pickup: Point; // pickup snapped onto the route
  drop: Point; // drop-off snapped onto the route
}

/**
 * Finds the route that serves both the pickup and the drop-off.
 * Points are snapped onto the route polyline (not just the stored route points),
 * so any spot within MAX_SNAP_KM of the route works. If no drop-off is given,
 * the route's end point is used.
 */
export const findRouteForTrip = async (
  pickupLat: number,
  pickupLng: number,
  dropLat?: number | null,
  dropLng?: number | null,
): Promise<TripRoute> => {
  const routes = await prisma.route.findMany({
    include: { points: { orderBy: { sequence: "asc" } } },
  });
  if (routes.length === 0) throw new Error("No routes available");

  const pickup: Point = [pickupLat, pickupLng];
  const hasDrop = dropLat != null && dropLng != null;

  let best: (TripRoute & { score: number }) | null = null;
  let pickupNearOnly = false;

  for (const route of routes) {
    const line: Point[] = route.points.length
      ? route.points.map((p): Point => [p.lat, p.lng])
      : [[route.startLat, route.startLng], [route.endLat, route.endLng]];

    const sp = snapToPolyline(pickup, line);
    if (!sp || sp.km > MAX_SNAP_KM) continue;
    pickupNearOnly = true;

    let drop: Point;
    let dropKm = 0;
    if (hasDrop) {
      const sd = snapToPolyline([dropLat as number, dropLng as number], line);
      if (!sd || sd.km > MAX_SNAP_KM) continue;
      drop = sd.point;
      dropKm = sd.km;
    } else {
      drop = [route.endLat, route.endLng];
    }

    const score = sp.km + dropKm;
    if (!best || score < best.score) {
      best = { routeId: route.id, routeName: route.name, pickup: sp.point, drop, score };
    }
  }

  if (!best) {
    throw new Error(
      pickupNearOnly
        ? "Your drop-off is not on the same route as your pickup (within 1 km)"
        : "No routes available within 1 km of your pickup",
    );
  }
  if (haversine(best.pickup, best.drop) < 0.3) {
    throw new Error("Pickup and drop-off are too close together");
  }
  return best;
};


export const getRouteById = async (routeId: string) => {

  if (!routeId) {
    throw new Error("Route ID is required");
  }

  const route = await prisma.route.findUnique({
    where: { id: routeId },
  });

  if (!route) {
    throw new Error("Route not found");
  }

  return route;
};




export const createRoute = async (
  name: string,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
) => {

  if (
    !name ||
    startLat === undefined ||
    startLng === undefined ||
    endLat === undefined ||
    endLng === undefined
  ) {
    throw new Error("All fields are required");
  }

  return await prisma.route.create({
    data: {
      name,
      startLat,
      startLng,
      endLat,
      endLng,
    },
  });
};




export const updateRoute = async (
  routeId: string,
  name: string,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
) => {

  if (
    !routeId ||
    !name ||
    startLat === undefined ||
    startLng === undefined ||
    endLat === undefined ||
    endLng === undefined
  ) {
    throw new Error("All fields are required");
  }

  return await prisma.route.update({
    where: { id: routeId },
    data: {
      name,
      startLat,
      startLng,
      endLat,
      endLng,
    },
  });
};




export const deleteRoute = async (routeId: string) => {

  if (!routeId) {
    throw new Error("Route ID is required");
  }

  return await prisma.route.delete({
    where: { id: routeId },
  });
};