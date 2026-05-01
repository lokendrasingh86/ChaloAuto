import { prisma } from "../lib/prisma.lib.ts";


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
  return await prisma.route.findMany();
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