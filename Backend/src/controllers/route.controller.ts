import type { Request, Response } from "express";
import {
  createRoute,
  deleteRoute,
  getAllRoutesList,
  getRouteById,
  updateRoute,
  findNearestRoutePoint
} from "../services/route.service.ts";

export const findNearestRoutePointController = async (req: Request, res: Response) => {
  try {
    const { passengerLat, passengerLng } = req.body;

    if (passengerLat === undefined || passengerLng === undefined) {
      return res.status(400).json({ message: "passengerLat and passengerLng are required" });
    }

    const bestRoute = await findNearestRoutePoint(passengerLat, passengerLng);
    return res.status(200).json({ bestRoute });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    } else {
      return res.status(400).json({ error: "An unknown error occurred" });
    }
  }
};

export const getRouteByIdController = async (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;

    if (!routeId) {
      return res.status(400).json({ message: "Route ID is required" });
    }

    const route = await getRouteById(routeId[0]!);

    return res.status(200).json(route);

  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }else{
      return res.status(400).json({ error: "An unknown error occurred" });
    }
  }
};


export const createRouteController = async (req: Request, res: Response) => {
  try {
    const { name, startLat, startLng, endLat, endLng } = req.body;

    if (
      !name ||
      startLat === undefined ||
      startLng === undefined ||
      endLat === undefined ||
      endLng === undefined
    ) {
      return res.status(400).json({
        message: "name, startLat, startLng, endLat, endLng are required",
      });
    }

    const route = await createRoute(
      name,
      startLat,
      startLng,
      endLat,
      endLng
    );

    return res.status(201).json(route);

  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }else{
      return res.status(400).json({ error: "An unknown error occurred" });
    }
  }
};




export const updateRouteController = async (req: Request, res: Response) => {
  try {
    const routeId = req.params.id;

    const { name, startLat, startLng, endLat, endLng } = req.body;

    if (!routeId) {
      return res.status(400).json({ message: "Route ID is required" });
    }

    if (
      !name ||
      startLat === undefined ||
      startLng === undefined ||
      endLat === undefined ||
      endLng === undefined
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const route = await updateRoute(
      routeId[0]!,
      name,
      startLat,
      startLng,
      endLat,
      endLng
    );

    return res.status(200).json(route);

  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    } else {
      return res.status(400).json({ error: "An unknown error occurred" });
    }
  }
};



export const deleteRouteController = async (req: Request, res: Response) => {
  try {
    const {id: routeId} = req.params;

    if (!routeId) {
      return res.status(400).json({ message: "Route ID is required" });
    }

    await deleteRoute(routeId[0]!);

    return res.status(200).json({ message: "Route deleted successfully" });

  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    } else {
      return res.status(400).json({ error: "An unknown error occurred" });
    }
  }
};




export const getAllRoutesController = async (_req: Request, res: Response) => {
  try {
    const routes = await getAllRoutesList();

    return res.status(200).json(routes);

  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    } else {
      return res.status(400).json({ error: "An unknown error occurred" });
    }
  }
};