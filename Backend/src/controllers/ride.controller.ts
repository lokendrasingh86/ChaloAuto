import type { Request, Response } from 'express';

import { findNearestBestRoute , requestRide} from '../services/ride.service.ts'


export const findNearestRoute = async (req : Request , res : Response) => {
    try {
        const { passengerLat , passengerLng } = req.body;

        if (passengerLat === undefined || passengerLng === undefined) {
            return res.status(400).json({ message: "passengerLat and passengerLng are required" });
        }

        const bestRoute = await findNearestBestRoute(passengerLat , passengerLng);
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
