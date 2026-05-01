import 'dotenv/config';
import { prisma } from '../src/lib/prisma.ts';

async function main() {
  console.log('🧹 Clearing old data...');

  await prisma.ride.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.routePoint.deleteMany({});
  await prisma.route.deleteMany({});

  console.log('🌍 Seeding routes...');

  const routeData = [
    {
      name: 'Connaught Place to IGI Airport',
      startLat: 28.6304,
      startLng: 77.2177,
      endLat: 28.5562,
      endLng: 77.1000,
      points: [
        { lat: 28.6304, lng: 77.2177, sequence: 1 },
        { lat: 28.5921, lng: 77.1659, sequence: 2 },
        { lat: 28.5562, lng: 77.1000, sequence: 3 },
      ],
    },
    {
      name: 'North Campus to South Extension',
      startLat: 28.6875,
      startLng: 77.2058,
      endLat: 28.5684,
      endLng: 77.2183,
      points: [
        { lat: 28.6875, lng: 77.2058, sequence: 1 },
        { lat: 28.6400, lng: 77.2100, sequence: 2 },
        { lat: 28.6000, lng: 77.2150, sequence: 3 },
        { lat: 28.5684, lng: 77.2183, sequence: 4 },
      ],
    },
    {
      name: 'Dwarka Sector 21 to Noida Sector 18',
      startLat: 28.5523,
      startLng: 77.0583,
      endLat: 28.5708,
      endLng: 77.3204,
      points: [
        { lat: 28.5523, lng: 77.0583, sequence: 1 },
        { lat: 28.5800, lng: 77.1500, sequence: 2 },
        { lat: 28.5900, lng: 77.2500, sequence: 3 },
        { lat: 28.5708, lng: 77.3204, sequence: 4 },
      ],
    },
    {
      name: 'Rohini to Karol Bagh',
      startLat: 28.7460,
      startLng: 77.1025,
      endLat: 28.6538,
      endLng: 77.1884,
      points: [
        { lat: 28.7460, lng: 77.1025, sequence: 1 },
        { lat: 28.7000, lng: 77.1400, sequence: 2 },
        { lat: 28.6538, lng: 77.1884, sequence: 3 },
      ],
    },
    {
      name: 'Lajpat Nagar to Hauz Khas',
      startLat: 28.5677,
      startLng: 77.2433,
      endLat: 28.5494,
      endLng: 77.2001,
      points: [
        { lat: 28.5677, lng: 77.2433, sequence: 1 },
        { lat: 28.5550, lng: 77.2200, sequence: 2 },
        { lat: 28.5494, lng: 77.2001, sequence: 3 },
      ],
    },
    {
      name: 'Vasant Kunj to Saket',
      startLat: 28.5293,
      startLng: 77.1539,
      endLat: 28.5245,
      endLng: 77.2066,
      points: [
        { lat: 28.5293, lng: 77.1539, sequence: 1 },
        { lat: 28.5350, lng: 77.1800, sequence: 2 },
        { lat: 28.5245, lng: 77.2066, sequence: 3 },
      ],
    },
    {
      name: 'Janakpuri to Rajouri Garden',
      startLat: 28.6219,
      startLng: 77.0878,
      endLat: 28.6475,
      endLng: 77.1197,
      points: [
        { lat: 28.6219, lng: 77.0878, sequence: 1 },
        { lat: 28.6300, lng: 77.1000, sequence: 2 },
        { lat: 28.6475, lng: 77.1197, sequence: 3 },
      ],
    },
    {
      name: 'ITO to Mayur Vihar',
      startLat: 28.6276,
      startLng: 77.2404,
      endLat: 28.6077,
      endLng: 77.2980,
      points: [
        { lat: 28.6276, lng: 77.2404, sequence: 1 },
        { lat: 28.6150, lng: 77.2700, sequence: 2 },
        { lat: 28.6077, lng: 77.2980, sequence: 3 },
      ],
    },
    {
      name: 'Anand Vihar to Seelampur',
      startLat: 28.6508,
      startLng: 77.3152,
      endLat: 28.6640,
      endLng: 77.2713,
      points: [
        { lat: 28.6508, lng: 77.3152, sequence: 1 },
        { lat: 28.6600, lng: 77.2900, sequence: 2 },
        { lat: 28.6640, lng: 77.2713, sequence: 3 },
      ],
    },
    {
      name: 'Chhatarpur to Qutub Minar',
      startLat: 28.4975,
      startLng: 77.1804,
      endLat: 28.5244,
      endLng: 77.1855,
      points: [
        { lat: 28.4975, lng: 77.1804, sequence: 1 },
        { lat: 28.5100, lng: 77.1830, sequence: 2 },
        { lat: 28.5244, lng: 77.1855, sequence: 3 },
      ],
    },
  ];

  const createdRoutes = [];

  for (const data of routeData) {
    const route = await prisma.route.create({
      data: {
        name: data.name,
        startLat: data.startLat,
        startLng: data.startLng,
        endLat: data.endLat,
        endLng: data.endLng,
        points: {
          create: data.points
        }
      }
    });

    createdRoutes.push(route);
  }

  console.log('✅ Routes created');

  console.log('👤 Seeding passengers...');

  const passengers = [];

  for (let i = 1; i <= 5; i++) {
    const user = await prisma.user.create({
      data: {
        name: `Passenger ${i}`,
        phone: `99990000${i.toString().padStart(2, '0')}`,
        role: 'Passenger'
      }
    });

    passengers.push(user);
  }

  console.log('✅ Passengers created');

  console.log('🚗 Seeding drivers...');

  const drivers = [];

  for (let i = 1; i <= 5; i++) {
    const driverUser = await prisma.user.create({
      data: {
        name: `Driver ${i}`,
        phone: `88880000${i.toString().padStart(2, '0')}`,
        role: 'Driver'
      }
    });

    const route = createdRoutes[i % createdRoutes.length];
    if (!route) {
      throw new Error('No routes created to assign to driver.');
    }

    const driver = await prisma.driver.create({
      data: {
        userId: driverUser.id,
        licenseNumber: `DL-2026-${i.toString().padStart(4, '0')}`,

        // ✅ IMPORTANT FIX

        routeId: route.id,

        currentLocationLat: route.startLat,
        currentLocationLng: route.startLng,

        isAvailable: true,

        vehicle: {
          create: {
            make: 'ChaloAuto',
            model: 'Rickshaw',
            year: 2023,
            licensePlate: `DL-1R-${i.toString().padStart(4, '0')}`,
          }
        }
      }
    });

    drivers.push(driver);
  }

  console.log('✅ Drivers created');

  console.log('🎯 Sample Data:');
  console.log('Passenger ID:', passengers[0]?.id);
  console.log('Driver ID:', drivers[0]?.id);
  console.log('Route ID:', createdRoutes[0]?.id);

  console.log('🚀 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error in seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });