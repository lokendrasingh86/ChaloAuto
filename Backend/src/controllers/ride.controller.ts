import type { Request, Response } from 'express';

import {  acceptRide, cancelRide, completeRide, findNearestRoutePoint, getRideStatus, requestRide, rideHistory } from '../services/ride.service.ts'


export const findNearestRoutePointController = async (req : Request , res : Response) => {
    try {
        const { passengerLat , passengerLng } = req.body;

        if (passengerLat === undefined || passengerLng === undefined) {
            return res.status(400).json({ message: "passengerLat and passengerLng are required" });
        }

        const bestRoute = await findNearestRoutePoint(passengerLat , passengerLng);
        return res.status(200).json({ bestRoute });

    } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }else{
      return res.status(400).json({ error: "An unknown error occurred" });
    }
  } 
}


export const requestRideController = async (req: Request, res: Response) => {
    try {
        const { passengerId, pickupLat, pickupLng } = req.body;
        if(!passengerId || pickupLat === undefined || pickupLng === undefined) {
            return res.status(400).json({ message: "passengerId, pickupLat and pickupLng are required" });
        } 

        const ride = await requestRide(passengerId, pickupLat, pickupLng);
        return res.status(201).json({ ride });
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }

}

export const acceptRideController = async (req: Request, res: Response) => {
    try{
        const { rideId, driverId } = req.body;
        if(!rideId || !driverId) {
            return res.status(400).json({ message: "rideId and driverId are required" });
        }
        const ride = await acceptRide(rideId, driverId);
        return res.status(200).json({ ride });
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}

export const completeRideController = async (req: Request, res: Response) => {
    try {
        const { rideId  } = req.body;
        if(!rideId) {
            return res.status(400).json({ message: "rideId is required" });
        }
        const ride = await completeRide(rideId);
        return res.status(200).json({ ride });
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}


export const cancelRideController = async (req: Request, res: Response) => {
    try {
        const { rideId } = req.body;
        if(!rideId) {
            return res.status(400).json({ message: "rideId is required" });
        }
        const ride = await cancelRide(rideId);
        return res.status(200).json({ ride });
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}


export const getRideStatusController = async (req: Request, res: Response) => {
    try {
        const { rideId } = req.params;
        if(!rideId) {
            return res.status(400).json({ message: "rideId is required" });
        }
        const status = await getRideStatus(rideId);
        return res.status(200).json({ status });
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}

export const rideHistoryController = async (req: Request, res: Response) => {
    try {
        const { passengerId } = req.params;
        if(!passengerId) {
            return res.status(400).json({ message: "passengerId is required" });
        }
        const history = await rideHistory(passengerId);
        return res.status(200).json({ history });
    }catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}


export const driverDashboardController = async (req: Request, res: Response) => {
    try {
        const { driverId } = req.params;
        if(!driverId) {
            return res.status(400).json({ message: "driverId is required" });
        }
        const dashboardData = await driverDashboard(driverId);
        return res.status(200).json({ dashboardData });
    }catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}


export const driverAvailabilityController = async (req: Request, res: Response) => {
    try {
        const { driverId, isAvailable } = req.body;
        if(!driverId || isAvailable === undefined) {
            return res.status(400).json({ message: "driverId and isAvailable are required" });
        }
        const driver = await updateDriverAvailability(driverId, isAvailable);
        return res.status(200).json({ driver });
    }catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}