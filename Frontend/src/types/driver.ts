// Driver Dashboard Type Definitions

export interface Driver {
  id: string;
  userId: string;
  licenseNumber: string;
  currentLocationLat: number;
  currentLocationLng: number;
  isAvailable: boolean;
  capacity?: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    phone: string;
    role: 'Driver' | 'Passenger';
  };
  vehicle?: Vehicle;
  route?: Route;
}

export interface Vehicle {
  id: string;
  driverId: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Route {
  id: string;
  name: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  drivers?: Driver[];
  rides?: Ride[];
  points?: RoutePoint[];
}

export interface RoutePoint {
  id: string;
  routeId: string;
  lat: number;
  lng: number;
  sequence: number;
}

export interface Ride {
  id: string;
  passengerId: string;
  routeId?: string;
  driverId?: string;
  pickupLat: number;
  pickupLng: number;
  dropLat?: number | null;
  dropLng?: number | null;
  status: RideStatus;
  poolId?: string | null;
  pickupSequence?: number | null;
  dropSequence?: number | null;
  distanceKm?: number | null;
  fare?: number | null;
  rating?: number | null;
  ratingComment?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  driver?: Driver;
  passenger?: {
    id: string;
    name: string;
    phone: string;
  };
  route?: Route;
}

export type RideStatus = 'Requested' | 'Accepted' | 'Completed' | 'Cancelled';

export interface RideRequest {
  id: string;
  passengerId: string;
  pickupLat: number;
  pickupLng: number;
  distance: number;
  passengerName: string;
  estimatedArrivalTime: number;
}

/** One passenger inside a pool offered to a driver (from the System-Aware matcher). */
export interface PoolRide {
  rideId: string;
  passengerId: string;
  passengerName: string;
  passengerPhone?: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number | null;
  dropLng: number | null;
  pickupSequence: number | null;
  dropSequence: number | null;
  fare: number;
  distanceKm: number;
}

export interface PoolStop {
  type: 'pickup' | 'dropoff';
  rideId: string;
  passengerName: string;
  lat: number;
  lng: number;
}

export interface PoolOffer {
  poolId: string;
  rides: PoolRide[];
  stops: PoolStop[];
  routeDistanceKm: number;
}

export interface DriverStats {
  todayTrips: number;
  todayEarnings: number;
  thisWeekEarnings: number;
  thisMonthEarnings: number;
  completedRides: number;
  cancelledRides: number;
  rating: number;
  reviewCount: number;
}

export interface Notification {
  id: string;
  type: 'ride_request' | 'ride_accepted' | 'ride_cancelled' | 'passenger_waiting' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

export interface DriverLocation {
  lat: number;
  lng: number;
  timestamp: Date;
}
