
import { prisma } from "../lib/prisma.ts";

function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    return Math.sqrt(
        Math.pow(a.latitude - b.latitude, 2) + 
        Math.pow(a.longitude - b.longitude, 2)
    );
}


export const findNearestRoutePoint= async (
    passengerLat : number , 
    passengerLng : number 
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
    if(!bestPoint) {
        throw new Error("No route points available");
    }
    return bestPoint;
}

export const findBestDriver = async (pickupPoint: {
  lat: number;
  lng: number;
  routeId: string;
}) => {
    const drivers = await prisma.driver.findMany({
        where: {
            routeId: pickupPoint.routeId,
            isAvailable: true,
            currentLat: { not: null },
            currentLng: { not: null }
        }
     });

    let minDistance = Infinity;
    let bestDriver = null;
    
    for(const driver of drivers) {
        const calculatedDistance = distance(
            { latitude: driver.currentLat!, longitude: driver.currentLng! },
            { latitude: pickupPoint.lat, longitude: pickupPoint.lng }
        );  
    if (calculatedDistance > 0.02) continue; 

    const score = calculatedDistance;

    if (score < minDistance) {
        minDistance = score;
        bestDriver = driver;
        }
    }
    if(!bestDriver) {
        throw new Error("No nearby drivers found on this route");
    }
    return bestDriver;
};


export const requestRide = async (passengerId: string, pickupLat: number, pickupLng: number) =>  {
    const pickUpPoint = await findNearestRoutePoint(pickupLat, pickupLng);
    if(!pickUpPoint ) {
        throw new Error("No routes available nearby");
    }
    const existingRide = await prisma.ride.findFirst({
        where: {
            passengerId,
            status: "Requested"
        }
    });
    if(existingRide) {
        throw new Error("You already have an active ride");
    }
    const bestDriver = await findBestDriver( pickUpPoint );
    await prisma.driver.update({
        where: { id: bestDriver.id },
        data: { isAvailable: false }
    });
    const ride = await prisma.ride.create({
        data: {
            passengerId,
            pickupLat,
            pickupLng,
            routeId: pickUpPoint.routeId,
            driverId: bestDriver.id,
            status: "Requested"
        }
    });

    return ride;
}



export const acceptRide = async (rideId: string, driverId: string) => {
    return await prisma.ride.update({
        where: { id: rideId },
        data: { status: "Accepted", driverId }
    });
}

export const  completeRide = async (rideId: string) => {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select: { driverId: true }
    });
    if(!ride) {
        throw new Error("Ride not found");
    }
    if(ride.driverId) {
        await prisma.driver.update({
            where: { id: ride.driverId },
            data: { isAvailable: true }
        });
    }
    return ride
}   
export const cancelRide = async (rideId: string) => {
  const ride = await prisma.ride.update({
    where: { id: rideId },
    data: { status: "Cancelled" }
  });

  if (ride.driverId) {
    await prisma.driver.update({
      where: { id: ride.driverId },
      data: { isAvailable: true }
    });
  }

  return ride;
};    
 
export const updateDriverLocation = async (driverId: string, lat: number, lng: number) => {
    return await prisma.driver.update({
        where: { id: driverId },
        data: { currentLat: lat, currentLng: lng }
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
