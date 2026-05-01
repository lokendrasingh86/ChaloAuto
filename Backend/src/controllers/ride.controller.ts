import type { Request, Response } from 'express';
import { prisma } from "../lib/prisma.ts";

import * as rideService from '../services/ride.service.ts';


export const requestRideController = async (req: Request, res: Response) => {
    try {
        const { passengerId, pickupLat, pickupLng } = req.body;
        if(!passengerId || pickupLat === undefined || pickupLng === undefined) {
            return res.status(400).json({ message: "passengerId, pickupLat and pickupLng are required" });
        } 
        
        // Verify that the user making the request is actually a passenger
        const user = await prisma.user.findUnique({
            where: { id: passengerId }
        });

        if (!user || user.role !== "Passenger") {
            return res.status(403).json({ message: "Only passengers are allowed to request rides" });
        }

        const ride = await rideService.requestRide(passengerId, pickupLat, pickupLng);
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
        const ride = await rideService.acceptRide(rideId, driverId);
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
        const ride = await rideService.completeRide(rideId);
        return res.status(200).json( ride );
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
        const ride = await rideService.cancelRide(rideId);
        return res.status(200).json( ride );
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
        const status = await rideService.getRideStatus(rideId as string);
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
        const history = await rideService.rideHistory(passengerId as string);
        return res.status(200).json({ history });
    }catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}


export const allRidesByPassengerController = async (req: Request, res: Response) => {
    try {
        const { passengerId } = req.params;
        if(!passengerId) {
            return res.status(400).json({ message: "passengerId is required" });
        }
        const history = await rideService.allRidesByPassenger(passengerId as string);
        return res.status(200).json({ history });
    }catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });  
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}


export const getCurrentRidesController = async (req: Request, res: Response) => {
    try {
        const { passengerId } = req.params;
        if(!passengerId) {
            return res.status(400).json({ message: "passengerId is required" });
        }
        const currentRides = await rideService.getCurrentRides(passengerId as string);
        return res.status(200).json({ currentRides });
    }catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}


export const rideDetailsController = async (req: Request, res: Response) => {
    try {
        const { rideId } = req.params;
        if(!rideId) {
            return res.status(400).json({ message: "rideId is required" });
        }
        const ride = await rideService.rideDetails(rideId as string);
        return res.status(200).json({ ride });
    }catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}


export const allRidesByDriverController = async (req: Request, res: Response) => {
    try {
        const { driverId } = req.params;
        if(!driverId) {
            return res.status(400).json({ message: "driverId is required" });
        }
        const history = await rideService.allRidesByDriver(driverId as string);
        return res.status(200).json({ history });
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
        const driver = await rideService.driverAvailability(driverId as string, isAvailable);
        return res.status(200).json({ driver });
    }catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}

export const updateDriverLocationController = async (req: Request, res: Response) => {
    try {
        const { driverId, lat, lng } = req.body;
        
        if (!driverId || lat === undefined || lng === undefined) {
            return res.status(400).json({ message: "driverId, lat, and lng are required" });
        }
        
        const driver = await rideService.updateDriverLocation(driverId as string, lat, lng);
        return res.status(200).json({ driver });
    } catch (error) {
        if (error instanceof Error) {
            return res.status(400).json({ error: error.message });
        } else {
            return res.status(400).json({ error: "An unknown error occurred" });
        }
    }
}