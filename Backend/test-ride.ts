import { findBestDriver, requestRide } from './src/services/ride.service.ts';
import { prisma } from './src/lib/prisma.ts';

async function test() {
    console.log("Checking drivers...");
    const drivers = await prisma.driver.findMany();
    console.log("All drivers:", drivers);
    
    // The passenger input:
    // pickupLat: 28.6304
    // pickupLng: 77.2177

    try {
        const ride = await requestRide("test-passenger", 28.6304, 77.2177);
        console.log("Ride requested!", ride);
    } catch(err) {
        console.error("Error requesting ride:", err.message);
    }
}

test();
