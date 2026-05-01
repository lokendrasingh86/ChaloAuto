import { prisma } from "../lib/prisma.lib.ts";



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