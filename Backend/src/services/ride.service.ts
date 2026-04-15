
import { prisma } from "../lib/prisma.ts";

// function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
//     return Math.sqrt(
//         Math.pow(a.latitude - b.latitude, 2) + 
//         Math.pow(a.longitude - b.longitude, 2)
//     );
// }

function distance ( a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    let dlat = (b.latitude - a.latitude) * Math.PI / 180;
    let dlon = (b.longitude - a.longitude) * Math.PI / 180;
    const lat1 = a.latitude * Math.PI / 180;
    const lat2 = b.latitude * Math.PI / 180;

    let x = Math.sin(dlat/2) * Math.sin(dlat/2) +
            Math.sin(dlon/2) * Math.sin(dlon/2) * Math.cos(lat1) * Math.cos(lat2); 
    let c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)); 
    let R = 6371;
    return R * c;
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
    if (minDistance > 1) {
        throw new Error("No nearby route points found");
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
    if (calculatedDistance > 1) continue; 
    const passengerDistance = 0;
    const score = calculatedDistance + passengerDistance;

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
    if (pickupLat == null || pickupLng == null) {
        throw new Error("Invalid coordinates");
    }

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
    

    const [ , ride] = await prisma.$transaction([
        prisma.driver.update({
            where: { id: bestDriver.id },
            data: { isAvailable: false }
        }),
        prisma.ride.create({
            data: {
            passengerId,
            pickupLat,
            pickupLng,
            routeId: pickUpPoint.routeId,
            driverId: bestDriver.id,
            status: "Requested"
        }
        })
    ]);
    return ride;
}



export const acceptRide = async (rideId: string, driverId: string) => {
    const ride = await prisma.ride.findFirst({
        where: { 
            id: rideId,
            status: "Requested",
            driverId
         }
    });
    if (!ride) {
        throw new Error("Ride not found");
    }
    if(ride.status !== "Requested") {
        throw new Error("Ride is not in a state to be accepted");
    }
    return await prisma.ride.update({
        where: { id: rideId },
        data: { status: "Accepted" }
    });
}


export const  completeRide = async (rideId: string) => {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select: { driverId: true }
    });
    if(!ride || !ride.driverId ) {
        throw new Error("Ride not found");
    }
    await prisma.$transaction([
        prisma.ride.update({
            where: { id: rideId },
            data: { status: "Completed" }
        }),
        prisma.driver.update({
            where: { id: ride.driverId! },
            data: { isAvailable: true }
        })
    ]);

    return {message : "Ride completed successfully"};
}   


export const cancelRide = async (rideId: string) => {

    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        select :{ driverId: true }
    });
    if(!ride) {
        throw new Error("Ride not found");
    }
    if(!ride.driverId) {   
        throw new Error("Ride has no assigned driver");
    }

    await prisma.$transaction([
    prisma.ride.update(
        {
            where: { id: rideId },
            data: { status: "Cancelled" }
        }
    ),
    prisma.driver.update(
        {
            where: { id: ride.driverId! },
            data: { isAvailable: true }
        }   
    )
    ]);
    return {message : "Ride cancelled successfully"};
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


export const rideHistory = async (passengerId: string) => {
    return await prisma.ride.findMany({
        where:{passengerId},
        orderBy: { createdAt: "desc" }
    })
}

export const allRidesByPassenger = async (passengerId: string) => {
    const ride = await prisma.ride.findMany({
        where: { passengerId },
        include: {
            driver: {
                select: {
                    user:{
                        select:{
                            name: true
                        }
                    },
                    currentLat: true,
                    currentLng: true
                }
            }
        }
    });
    return ride;
}

export const getCurrentRides = async (passengerId: string) => {
    const ride = await prisma.ride.findMany({
        where: {
            passengerId,
            status:{
                in: ["Requested", "Accepted"]
            }
        }, 
        include: {
            driver: {
                select: {
                    user : {
                        select: {
                            name: true
                        }
                    },
                    currentLat: true,
                    currentLng: true
                }
            }
        }
    });
    return ride;
}

export const rideDetails = async (rideId: string) => {
    const ride = await prisma.ride.findUnique({
        where: { id: rideId },
        include: {
            driver: {
                select: {
                    user : {
                        select: {
                            name: true
                        }
                    },
                    currentLat: true,
                    currentLng: true
                }
            },
            passenger: {
                select: {
                    name: true
                }
            }
        }
    });
    return ride;
}

export const allRidesByDriver = async (driverId: string) => {
    const ride = await prisma.ride.findMany({
        where: { driverId },
        include: {
            passenger: {
                select: {
                    name: true
                }
            }
        }
    });
    return ride;
}

export const driverAvailability = async (driverId: string, isAvailable: boolean) => {
    return await prisma.driver.update({
        where: { id: driverId },
        data: { isAvailable }
    });
}



