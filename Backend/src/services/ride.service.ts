import e from "express";
import { prisma } from "../lib/prisma.ts";

function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    return Math.sqrt(
        Math.pow(a.latitude - b.latitude, 2) + 
        Math.pow(a.longitude - b.longitude, 2)
    );
}

export const findNearestBestRoute = async (
    passengerLat : number , 
    passengerLng : number ,
    
) => {
    const points = await prisma.routePoint.findMany();
    let minDistance = Infinity;
    let bestPoint = null;

    for(const point of points) {
        const calculatedDistance = distance(
            { latitude: passengerLat, longitude: passengerLng },
            { latitude: point.lat, longitude: point.lng }
        );
        if(calculatedDistance < minDistance) {
            minDistance = calculatedDistance;
            bestPoint = point;
        }
    }
    return bestPoint;
}

export const findBestDriver = async (pickupPoint : any) => {
    const drivers = await prisma.driver.findMany({
        where: {
            routeId: pickupPoint.routeId,
            currentLat: { not: null },
            currentLng: { not: null }
        }
    });

    let minDistance = Infinity;
    let bestDriver = null;
    for(const driver of drivers) {
        const calculatedDistance = distance(
            { latitude: driver.currentLat, longitude: driver.currentLng },
            { latitude: pickupPoint.lat, longitude: pickupPoint.lng }
        );  
        if(calculatedDistance < minDistance) {
            minDistance = calculatedDistance;
            bestDriver = driver;
        }
    }
    if(!bestDriver) {
        throw new Error("No drivers available nearby");
    }
    return bestDriver;
};


export const requestRide = async (passengerId: string, pickupLat: number, pickupLng: number) =>  {
    const pickUp = await findNearestBestRoute(pickupLat, pickupLng);
    if(!pickUp) {
        throw new Error("No routes available nearby");
    }

    const bestDriver = await findBestDriver( pickUp);

    const ride = await prisma.ride.create({
        data: {
            passengerId,
            pickupLat,
            pickupLng,
            routeId: pickUp.routeId,
            driverId: bestDriver.id,
            status: "REQUESTED"
        }
    });
    return ride;
}


export const acceptRide = async (rideId: string, driverId: string) => {
    return await prisma.ride.update({
        where: { id: rideId },
        data: { status: "ACCEPTED", driverId }
    });
}

export const  completeRide = async (rideId: string) => {
    return await prisma.ride.update({
        where: { id: rideId },
        data: { status: "COMPLETED" }
    });
}   
export const cancelRide = async (rideId: string) => {
    return await prisma.ride.update({
        where: { id: rideId },
        data: { status: "CANCELLED" }
    });
}       
 
export const updateDriverLocation = async (driverId: string, lat: number, lng: number) => {
    return await prisma.driver.update({
        where: { id: driverId },
        data: { currentLocationLat: lat, currentLocationLng: lng }
    });
}


export const getRideStatus = async (rideId: string) => {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },  
        select: { status: true }
    });
    if(!ride) {
        throw new Error("Ride not found");
    }
    return ride.status;
}
