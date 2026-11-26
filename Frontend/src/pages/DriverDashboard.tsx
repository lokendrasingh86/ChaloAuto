import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { socket } from '@/lib/socket';
import MapView, { type MapLine, type MapMarker } from '@/components/MapView';
import { haversineKm, inr, type LatLng } from '@/lib/geo';
import {
  Home, Navigation2, History, MapPin, TrendingUp, User, Settings, Bell,
  ChevronDown, Power, PowerOff, Phone, MapIcon, CheckCircle2, XCircle,
  Clock, DollarSign, Star, AlertCircle, Loader, LogOut, Menu, X, Car
} from 'lucide-react';
import type { Driver, Ride, DriverStats, Notification, PoolOffer, PoolRide } from '@/types/driver';

// ============= SIDEBAR COMPONENT =============
function DriverSidebar({ activeSection, setActiveSection }: any) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { icon: Home, label: 'Dashboard', id: 'dashboard' },
    { icon: Navigation2, label: 'Current Ride', id: 'current-ride' },
    { icon: History, label: 'Ride History', id: 'ride-history' },
    { icon: MapPin, label: 'My Route', id: 'my-route' },
    { icon: TrendingUp, label: 'Earnings', id: 'earnings' },
    { icon: User, label: 'Profile', id: 'profile' },
    { icon: Settings, label: 'Settings', id: 'settings' },
  ];

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-md"
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed lg:static w-64 h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-30 ${
          mobileMenuOpen ? 'left-0' : '-left-64 lg:left-0'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#0D9488] to-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">🚗</span>
          </div>
          <div>
            <h1 className="font-black text-slate-800">ChaloAuto</h1>
            <p className="text-xs text-slate-500 font-semibold">Driver</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 mt-6 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                activeSection === item.id
                  ? 'bg-gradient-to-r from-[#0D9488] to-teal-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

// ============= HEADER COMPONENT =============
function DriverHeader({ driver, isOnline, toggleOnlineStatus, unreadNotifications }: any) {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
      <div>
        <h1 className="text-2xl font-black text-slate-800">ChaloAuto Driver</h1>
        <p className="text-xs text-slate-500 mt-0.5">Welcome back, {driver?.user?.name || 'Driver'}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Online Status Toggle */}
        <button
          onClick={toggleOnlineStatus}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
            isOnline
              ? 'bg-green-50 text-green-700 hover:bg-green-100'
              : 'bg-red-50 text-red-600 hover:bg-red-100'
          }`}
        >
          {isOnline ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
          {isOnline ? 'Online' : 'Offline'}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-all">
            <Bell className="w-6 h-6 text-slate-600" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unreadNotifications}
              </span>
            )}
          </button>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600">
            {driver?.user?.name?.charAt(0) || 'D'}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">{driver?.user?.name || 'Driver'}</p>
            <p className="text-xs text-slate-500">{driver?.vehicle?.licensePlate || 'N/A'}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </header>
  );
}

// ============= STAT CARD COMPONENT =============
function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-black text-slate-800">{value}</p>
    </div>
  );
}

// ============= INCOMING POOL OFFER COMPONENT =============
function IncomingRideRequests({ offer, onAccept, onReject, loading, now, clockOffset }: any) {
  const pool = offer as PoolOffer | null;
  if (!pool) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600 font-semibold">No incoming requests</p>
        <p className="text-sm text-slate-500 mt-1">Stay online. The matcher will send you passengers heading the same way.</p>
      </div>
    );
  }

  const remaining = pool.expiresAt ? Math.max(0, Math.ceil((Date.parse(pool.expiresAt) - now - clockOffset) / 1000)) : null;
  const total = pool.rides.reduce((sum, r) => sum + r.fare, 0);

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-amber-600 animate-bounce" />
          <h3 className="text-lg font-black text-amber-900">Incoming Ride Request</h3>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-white border border-amber-200 text-amber-700">
          {pool.rides.length} passenger{pool.rides.length > 1 ? 's' : ''}{pool.rides.length > 1 ? ' · shared' : ''}
        </span>
      </div>

      {remaining != null && <p role="status" className="mb-3 font-bold">Response window: {remaining}s</p>}
      <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wider">Suggested stop order</p>
      <ol className="space-y-2 mb-4">
        {pool.stops.map((stop, i) => (
          <li key={`${stop.rideId}-${stop.type}`} className="flex items-center gap-3 bg-white/70 rounded-lg px-3 py-2 border border-amber-100">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <span className="text-sm font-semibold text-slate-800">
              {stop.type === 'pickup' ? 'Pick up' : 'Drop'} {stop.passengerName}
            </span>
            <span className="ml-auto text-xs font-mono text-slate-500">{stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</span>
          </li>
        ))}
      </ol>

      <div className="flex justify-between text-sm mb-6">
        <span hidden={pool.mode === 'Choice' && !pool.routeDistanceKm} className="text-amber-800 font-semibold">Route length ≈ {pool.routeDistanceKm.toFixed(1)} km</span>
        <span className="font-black text-slate-800">Total fare {inr(total)}</span>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReject}
          disabled={loading || remaining === 0}
          className="flex-1 px-4 py-3 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <XCircle className="w-5 h-5" />
          Reject
        </button>
        <button
          onClick={onAccept}
          disabled={loading || remaining === 0}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
        >
          {loading ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          Accept
        </button>
      </div>
    </div>
  );
}

// ============= CURRENT POOL COMPONENT =============
function CurrentRideSection({ rides, driverPos, onComplete, onPickup, simulate, onToggleSimulate, loading }: any) {
  const pool = (rides || []) as Ride[];
  if (pool.length === 0) return null;

  const canonicalStops = pool.find(r => r.plannerMode === 'Choice')?.plannedStops;
  const pickups = [...pool].sort((a, b) => (a.pickupSequence ?? 99) - (b.pickupSequence ?? 99));
  const drops = [...pool].sort((a, b) => (a.dropSequence ?? 99) - (b.dropSequence ?? 99));

  const markers: MapMarker[] = [];
  pickups.forEach((r) =>
    markers.push({ id: `p-${r.id}`, lat: r.pickupLat, lng: r.pickupLng, kind: 'pickup', label: String(r.pickupSequence ?? '') }),
  );
  drops.forEach((r) => {
    if (r.dropLat != null && r.dropLng != null) {
      markers.push({ id: `d-${r.id}`, lat: r.dropLat, lng: r.dropLng, kind: 'drop', label: String(r.dropSequence ?? '') });
    }
  });
  if (driverPos) markers.push({ id: 'me', lat: driverPos[0], lng: driverPos[1], kind: 'driver' });

  const stopPoints: LatLng[] = canonicalStops ? [ ...(driverPos ? [driverPos as LatLng] : []), ...canonicalStops.map((stop): LatLng => [stop.lat, stop.lng]) ] : [
    ...(driverPos ? [driverPos as LatLng] : []),
    ...pickups.map((r): LatLng => [r.pickupLat, r.pickupLng]),
    ...drops.filter((r) => r.dropLat != null).map((r): LatLng => [r.dropLat as number, r.dropLng as number]),
  ];
  const lines: MapLine[] = [{ id: 'plan', points: stopPoints, color: '#F59E0B', dashed: true }];

  const navigateToRide = (ride: Ride) => {
    if (canonicalStops?.length) {
      const points = canonicalStops.map(stop => `${stop.lat},${stop.lng}`);
      const origin = driverPos ? `${driverPos[0]},${driverPos[1]}` : points[0];
      const destination = points[points.length - 1];
      const waypoints = points.slice(0, -1).join('|');
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}`, '_blank');
      return;
    }
    const origin = driverPos
      ? `${driverPos[0]},${driverPos[1]}`
      : `${ride.pickupLat},${ride.pickupLng}`;
    const destination = ride.dropLat != null && ride.dropLng != null
      ? `${ride.dropLat},${ride.dropLng}`
      : `${ride.pickupLat},${ride.pickupLng}`;
    const waypoints = origin !== `${ride.pickupLat},${ride.pickupLng}`
      ? `&waypoints=${ride.pickupLat},${ride.pickupLng}`
      : '';
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}`,
      '_blank',
    );
  };

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Navigation2 className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-black text-green-900">
            Active Ride{pool.length > 1 ? ` · ${pool.length} passengers (shared)` : ''}
          </h3>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-green-800 cursor-pointer select-none">
          <input type="checkbox" checked={simulate} onChange={onToggleSimulate} />
          Simulate driving (demo)
        </label>
      </div>

      {canonicalStops && <ol className="mb-4 text-sm">{canonicalStops.map((stop, index) => <li key={`${stop.rideId}-${stop.type}`}>{index + 1}. {stop.type === 'pickup' ? 'Pick up' : 'Drop off'} {stop.passengerName}</li>)}</ol>}
      <MapView markers={markers} lines={lines} height={280} className="mb-5" />

      <div className="space-y-3">
        {pickups.map((r) => (
          <div key={r.id} className="bg-white p-4 rounded-lg border border-green-100 flex flex-wrap items-center gap-4">
            <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">
              {r.pickupSequence ?? '-'}
            </span>
            <div className="flex-1 min-w-[140px]">
              <p className="font-bold text-slate-800">{r.passenger?.name || 'Passenger'}</p>
              <p className="text-xs text-slate-500">{r.passenger?.phone || 'N/A'}</p>
            </div>
            <div className="text-xs text-slate-500">
              <p>Pickup #{r.pickupSequence ?? '-'} · Drop #{r.dropSequence ?? '-'}</p>
              <p className="font-bold text-slate-700">{inr(r.lockedFare ?? r.fare)}</p>
            </div>
            <button
              onClick={() => navigateToRide(r)}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-lg text-sm flex items-center gap-1"
            >
              <MapIcon className="w-4 h-4" /> Navigate
            </button>
            <button
              onClick={() => r.plannerMode === 'Choice' && r.status === 'Accepted' ? onPickup(r.id) : onComplete(r.id)}
              disabled={loading || (!!canonicalStops && (canonicalStops[0]?.rideId !== r.id || canonicalStops[0]?.type !== (r.status === 'Accepted' ? 'pickup' : 'dropoff')))}
              title={canonicalStops ? 'Follow the remaining stop order shown above' : undefined}
              className="px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {r.plannerMode === 'Choice' && r.status === 'Accepted' ? 'Picked up' : 'Dropped off'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============= EARNINGS CARD COMPONENT =============
function EarningsCard({ stats }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-green-600" />
        Earnings Summary
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-xs text-slate-500 font-bold mb-2">TODAY</p>
          <p className="text-2xl font-black text-green-600">₹{stats.todayEarnings}</p>
        </div>
        <div className="text-center border-x border-slate-200">
          <p className="text-xs text-slate-500 font-bold mb-2">THIS WEEK</p>
          <p className="text-2xl font-black text-slate-800">₹{stats.thisWeekEarnings}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 font-bold mb-2">THIS MONTH</p>
          <p className="text-2xl font-black text-slate-800">₹{stats.thisMonthEarnings}</p>
        </div>
      </div>
    </div>
  );
}

// ============= MAIN DRIVER DASHBOARD =============
export default function DriverDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [activeSection, setActiveSection] = useState('dashboard');
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [currentPool, setCurrentPool] = useState<Ride[]>([]);
  const [offer, setOffer] = useState<PoolOffer | null>(null);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [stats, setStats] = useState<DriverStats>({
    todayTrips: 0,
    todayEarnings: 0,
    thisWeekEarnings: 0,
    thisMonthEarnings: 0,
    completedRides: 0,
    cancelledRides: 0,
    rating: 0,
    reviewCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [clockOffset, setClockOffset] = useState(0);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const refreshGenerationRef = useRef(0);
  const poolRevisionRef = useRef(0);
  const positionRevisionRef = useRef(0);

  // Fetch initial data
  useEffect(() => {
    if (!user?.id || !user?.driver?.id) {
      navigate('/login');
      return;
    }

    fetchDriverData();
  }, [user?.id]);

  const offerFromRides = (rides: Ride[], serverTime?: string): PoolOffer | null => {
    if (rides.length === 0) return null;
    const ordered = [...rides].sort((x, y) => (x.pickupSequence ?? 99) - (y.pickupSequence ?? 99));
    const poolRides: PoolRide[] = ordered.map((r) => ({
      rideId: r.id,
      passengerId: r.passengerId,
      passengerName: r.passenger?.name || 'Passenger',
      passengerPhone: r.passenger?.phone,
      pickupLat: r.pickupLat,
      pickupLng: r.pickupLng,
      dropLat: r.dropLat ?? null,
      dropLng: r.dropLng ?? null,
      pickupSequence: r.pickupSequence ?? null,
      dropSequence: r.dropSequence ?? null,
      fare: r.fare ?? 0,
      distanceKm: r.distanceKm ?? 0,
    }));
    const stops = [
      ...ordered.map((r) => ({ type: 'pickup' as const, rideId: r.id, passengerName: r.passenger?.name || 'Passenger', lat: r.pickupLat, lng: r.pickupLng })),
      ...[...rides]
        .sort((x, y) => (x.dropSequence ?? 99) - (y.dropSequence ?? 99))
        .filter((r) => r.dropLat != null)
        .map((r) => ({ type: 'dropoff' as const, rideId: r.id, passengerName: r.passenger?.name || 'Passenger', lat: r.dropLat as number, lng: r.dropLng as number })),
    ];
    return { poolId: ordered[0]?.poolId || ordered[0]!.id, rides: poolRides, stops: ordered[0].plannedStops ?? stops, routeDistanceKm: 0, mode: ordered[0].plannerMode, expiresAt: ordered[0].offerExpiresAt, serverTime };
  };

  const fetchDriverData = async () => {
    const generation = ++refreshGenerationRef.current;
    const poolRevision = poolRevisionRef.current;
    const positionRevision = positionRevisionRef.current;
    try {
      const driverId = user.driver?.id;
      const [profileRes, ridesRes, statsRes, poolRes] = await Promise.all([
        api.get(`/users/${user.id}`),
        api.get(`/rides/driver/${driverId}/all`),
        api.get(`/rides/driver/${driverId}/stats`),
        api.get(`/rides/driver/${driverId}/current`),
      ]);
      if (generation !== refreshGenerationRef.current) return;

      const { driver: profile, ...driverUser } = profileRes.data;
      setDriver(profile ? { ...profile, user: driverUser } : null);
      setIsOnline(profileRes.data.driver?.isAvailable || false);
      setRideHistory(ridesRes.data.history || []);
      setStats(statsRes.data.stats);

      if (profile && positionRevision === positionRevisionRef.current) setDriverPos([profile.currentLocationLat, profile.currentLocationLng]);

      if (poolRevision === poolRevisionRef.current) {
        const active: Ride[] = poolRes.data.rides || [];
        setCurrentPool(active.filter((r) => r.status === 'Accepted' || r.status === 'PickedUp'));
        if (poolRes.data.serverTime) setClockOffset(Date.parse(poolRes.data.serverTime) - Date.now());
        setOffer(offerFromRides(active.filter((r) => r.status === 'Requested'), poolRes.data.serverTime));
      }
    } catch (err) {
      console.error('Failed to load driver data', err);
      toast({ title: 'Error', description: 'Failed to load driver data', variant: 'destructive' });
    }
  };

  const refreshDriverRef = useRef(fetchDriverData);
  refreshDriverRef.current = fetchDriverData;

  // Socket.IO connections (the server puts this driver in their rooms from the login token)
  useEffect(() => {
    if (!user?.driver?.id) return;

    const onNewRequest = (data: PoolOffer) => {
      poolRevisionRef.current++;
      setOffer(data);
      if (data.serverTime) setClockOffset(Date.parse(data.serverTime) - Date.now());
      toast({ title: 'New Ride Request', description: `${data.rides.length} passenger(s) matched to you.` });
      addNotification({
        id: Date.now().toString(),
        type: 'ride_request',
        title: 'New Ride Request',
        message: `${data.rides.length} passenger(s) are waiting`,
        timestamp: new Date(),
        read: false,
      });
    };
    const onExpired = () => {
      poolRevisionRef.current++;
      setOffer(null);
      void refreshDriverRef.current();
      toast({ title: 'Request expired', description: 'The passenger can choose a driver again.' });
    };
    const onCancelled = () => {
      poolRevisionRef.current++;
      toast({ title: 'Ride cancelled', description: 'A passenger cancelled their ride.', variant: 'destructive' });
      fetchDriverData();
    };
    const onConnect = () => {
      poolRevisionRef.current++;
      void refreshDriverRef.current();
    };

    socket.on('connect', onConnect);
    socket.on('newRideRequest', onNewRequest);
    socket.on('requestExpired', onExpired);
    socket.on('rideCancelled', onCancelled);
    socket.on('rideCompleted', onConnect);
    socket.on('ridePickedUp', onConnect);
    socket.on('rideAccepted', onConnect);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('newRideRequest', onNewRequest);
      socket.off('requestExpired', onExpired);
      socket.off('rideCancelled', onCancelled);
      socket.off('rideCompleted', onConnect);
      socket.off('ridePickedUp', onConnect);
      socket.off('rideAccepted', onConnect);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.driver?.id]);

  // Live location: GPS when available, or a simulated drive along the planned stops for demos.
  const poolRef = useRef<Ride[]>([]);
  const posRef = useRef<LatLng | null>(null);
  const reachedRef = useRef<Set<string>>(new Set());
  poolRef.current = currentPool;
  posRef.current = driverPos;

  useEffect(() => {
    if ((!isOnline && currentPool.length === 0) || !user?.driver?.id) return;
    let active = true;
    let lastSent = 0;
    const push = (lat: number, lng: number) => {
      if (!active) return;
      positionRevisionRef.current++;
      setDriverPos([lat, lng]);
      const now = Date.now();
      if (now - lastSent < 4000) return;
      lastSent = now;
      api.post('/rides/driver/location', { lat, lng }).catch(() => undefined);
    };

    let watchId: number | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    if (simulate) {
      timer = setInterval(() => {
        const pool = poolRef.current;
        const cur = posRef.current;
        if (!cur || pool.length === 0) return;
        const canonical = pool.find(r => r.plannerMode === 'Choice')?.plannedStops;
        if (canonical) {
          const next = canonical[0];
          if (!next) return;
          const target: LatLng = [next.lat, next.lng];
          const distance = haversineKm(cur, target);
          if (distance < 0.01) return; // Driver records pickup/drop-off explicitly.
          const fraction = Math.min(1, 0.3 / distance);
          push(cur[0] + (target[0] - cur[0]) * fraction, cur[1] + (target[1] - cur[1]) * fraction);
          return;
        }
        const pickups = [...pool].sort((a, b) => (a.pickupSequence ?? 99) - (b.pickupSequence ?? 99));
        const drops = [...pool].sort((a, b) => (a.dropSequence ?? 99) - (b.dropSequence ?? 99));
        let target: LatLng | null = null;
        let pickupId: string | null = null;
        for (const r of pickups) {
          if (!reachedRef.current.has(r.id)) {
            target = [r.pickupLat, r.pickupLng];
            pickupId = r.id;
            break;
          }
        }
        if (!target) {
          const next = drops.find((r) => r.dropLat != null);
          if (next) target = [next.dropLat as number, next.dropLng as number];
        }
        if (!target) return;
        const d = haversineKm(cur, target);
        if (d < 0.05) {
          if (pickupId) reachedRef.current.add(pickupId);
          return;
        }
        const f = Math.min(1, 0.3 / d); // about 300 m per tick
        push(cur[0] + (target[0] - cur[0]) * f, cur[1] + (target[1] - cur[1]) * f);
      }, 3000);
    } else if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => push(pos.coords.latitude, pos.coords.longitude),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 3000 },
      );
      // Stationary watches may stay silent; obtain a new fix rather than resend an old coordinate.
      timer = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => push(pos.coords.latitude, pos.coords.longitude),
          () => undefined,
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
        );
      }, 20000);
    }

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, simulate, user?.driver?.id, currentPool.length > 0]);

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      await api.post('/rides/driver/availability', {
        driverId: user.driver.id,
        isAvailable: newStatus,
      });
      setIsOnline(newStatus);
      toast({
        title: newStatus ? 'You are Online' : 'You are Offline',
        description: newStatus ? 'Ready to receive rides' : 'Not receiving ride requests',
      });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleAcceptRide = async () => {
    const first = offer?.rides[0];
    if (!first) return;
    poolRevisionRef.current++;
    setLoading(true);
    try {
      await api.post('/rides/accept', { rideId: first.rideId });
      reachedRef.current = new Set();
      addNotification({
        id: Date.now().toString(),
        type: 'ride_accepted',
        title: 'Ride Accepted',
        message: 'You have accepted the ride request',
        timestamp: new Date(),
        read: false,
      });
      toast({ title: 'Success', description: 'Ride accepted!' });
      await fetchDriverData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.error || err.response?.data?.message || 'Failed to accept ride', variant: 'destructive' });
      fetchDriverData();
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineRide = async () => {
    const first = offer?.rides[0];
    if (!first) return;
    poolRevisionRef.current++;
    setLoading(true);
    try {
      await api.post('/rides/decline', { rideId: first.rideId });
      setOffer(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.error || 'Failed to decline', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePickupRide = async (rideId: string) => {
    poolRevisionRef.current++;
    setLoading(true);
    try {
      await api.post('/rides/pickup', { rideId });
      await fetchDriverData();
    } catch (err) {
      toast({ title: 'Could not record pickup', description: (err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Please retry.', variant: 'destructive' });
      await fetchDriverData();
    } finally { setLoading(false); }
  };

  const handleCompleteRide = async (rideId: string) => {
    poolRevisionRef.current++;
    setLoading(true);
    try {
      const res = await api.post('/rides/complete', { rideId });
      toast({ title: 'Ride completed', description: `Collect ${inr(res.data.ride?.fare)} from the passenger.` });
      await fetchDriverData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.error || err.response?.data?.message || 'Failed to complete ride', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!offer?.expiresAt) return;
    const delay = Math.max(0, Date.parse(offer.expiresAt) - Date.now() - clockOffset) + 100;
    const timer = setTimeout(() => { void refreshDriverRef.current(); }, delay);
    return () => clearTimeout(timer);
  }, [offer?.expiresAt, clockOffset]);

  const addNotification = (notif: Notification) => {
    setNotifications((prev) => [notif, ...prev].slice(0, 10));
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <DriverSidebar activeSection={activeSection} setActiveSection={setActiveSection} />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Header */}
        <DriverHeader
          driver={driver}
          isOnline={isOnline}
          toggleOnlineStatus={toggleOnlineStatus}
          unreadNotifications={notifications.filter((n) => !n.read).length}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {/* Dashboard Section */}
          {activeSection === 'dashboard' && (
            <>
              {/* Top Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={Power}
                  label="Status"
                  value={isOnline ? 'Online' : 'Offline'}
                  color={isOnline ? 'bg-green-500' : 'bg-red-500'}
                />
                <StatCard icon={Navigation2} label="Today's Trips" value={stats.todayTrips} color="bg-blue-500" />
                <StatCard icon={DollarSign} label="Today's Earnings" value={`₹${stats.todayEarnings}`} color="bg-green-600" />
                <StatCard icon={Star} label="Rating" value={`${stats.rating} ⭐`} color="bg-amber-500" />
              </div>

              {/* Incoming Requests & Current Ride */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h2 className="text-lg font-black text-slate-800 mb-4">Ride Requests</h2>
                  <IncomingRideRequests
                    now={now}
                    clockOffset={clockOffset}
                    offer={offer}
                    onAccept={handleAcceptRide}
                    onReject={handleDeclineRide}
                    loading={loading}
                  />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-800 mb-4">Quick Stats</h2>
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 font-bold mb-1">Completed</p>
                      <p className="text-2xl font-black text-green-600">{stats.completedRides}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 font-bold mb-1">Cancelled</p>
                      <p className="text-2xl font-black text-red-600">{stats.cancelledRides}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 font-bold mb-1">Reviews</p>
                      <p className="text-2xl font-black text-blue-600">{stats.reviewCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Ride */}
              {currentPool.length > 0 && (
                <>
                  <h2 className="text-lg font-black text-slate-800">Current Activity</h2>
                  <CurrentRideSection
                    rides={currentPool}
                    driverPos={driverPos}
                    onPickup={handlePickupRide}
                    onComplete={handleCompleteRide}
                    simulate={simulate}
                    onToggleSimulate={() => setSimulate((v) => !v)}
                    loading={loading}
                  />
                </>
              )}

              {/* Earnings Summary */}
              <EarningsCard stats={stats} />

              {/* Recent Trips */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Recent Trips
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-bold text-slate-600">Passenger</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-600">Time</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-600">Status</th>
                        <th className="text-right py-3 px-4 font-bold text-slate-600">Fare</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rideHistory.slice(0, 5).map((ride, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-all">
                          <td className="py-3 px-4">{ride.passenger?.name || 'N/A'}</td>
                          <td className="py-3 px-4 text-slate-500">
                            {new Date(ride.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                ride.status === 'Completed'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-600'
                              }`}
                            >
                              {ride.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800">{ride.status === 'Completed' ? inr(ride.fare) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* CURRENT RIDE SECTION */}
          {activeSection === 'current-ride' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800">Current Ride</h2>
              {currentPool.length > 0 ? (
                <CurrentRideSection
                  rides={currentPool}
                  driverPos={driverPos}
                  onPickup={handlePickupRide}
                  onComplete={handleCompleteRide}
                  simulate={simulate}
                  onToggleSimulate={() => setSimulate((v) => !v)}
                  loading={loading}
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <Navigation2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-semibold">No active ride</p>
                  <p className="text-sm text-slate-500 mt-1">Accepted rides and their stop order will show up here.</p>
                </div>
              )}
            </div>
          )}

          {activeSection === 'ride-history' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800">Ride History</h2>
              <div className="flex gap-2 mb-4">
                <button className="px-4 py-2 bg-[#0D9488] text-white font-bold rounded-lg">All</button>
                <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50">Completed</button>
                <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50">Cancelled</button>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-4 px-6 font-bold text-slate-600">Passenger</th>
                      <th className="text-left py-4 px-6 font-bold text-slate-600">Date</th>
                      <th className="text-left py-4 px-6 font-bold text-slate-600">Distance</th>
                      <th className="text-left py-4 px-6 font-bold text-slate-600">Fare</th>
                      <th className="text-left py-4 px-6 font-bold text-slate-600">Status</th>
                      <th className="text-left py-4 px-6 font-bold text-slate-600">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rideHistory.length > 0 ? rideHistory.map((ride, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-all">
                        <td className="py-4 px-6 font-semibold text-slate-800">{ride.passenger?.name || 'N/A'}</td>
                        <td className="py-4 px-6 text-slate-600">{new Date(ride.createdAt).toLocaleDateString()}</td>
                        <td className="py-4 px-6 font-semibold text-slate-800">{ride.distanceKm != null ? `${Number(ride.distanceKm).toFixed(1)} km` : '—'}</td>
                        <td className="py-4 px-6 font-bold text-green-600">{ride.status === 'Completed' ? inr(ride.fare) : '—'}</td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            ride.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {ride.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-bold text-amber-500">{ride.rating ? `⭐ ${ride.rating}` : '—'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">No rides yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MY ROUTE SECTION */}
          {activeSection === 'my-route' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800">My Route</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-black text-slate-800 mb-4">Route Details</h3>
                  {(() => {
                    const route = driver?.route;
                    const routePoints: LatLng[] = route?.points?.length
                      ? [...route.points]
                          .sort((a, b) => a.sequence - b.sequence)
                          .map((point): LatLng => [point.lat, point.lng])
                      : route
                        ? [[route.startLat, route.startLng], [route.endLat, route.endLng]]
                        : [];
                    const routeMarkers: MapMarker[] = route
                      ? [
                          { id: 'route-start', lat: route.startLat, lng: route.startLng, kind: 'pickup', label: 'A' },
                          { id: 'route-end', lat: route.endLat, lng: route.endLng, kind: 'drop', label: 'B' },
                        ]
                      : [];
                    return routePoints.length > 1 ? (
                      <MapView
                        markers={routeMarkers}
                        lines={[{ id: 'driver-route', points: routePoints, color: '#0D9488', weight: 5 }]}
                        height={360}
                        className="mb-6"
                      />
                    ) : null;
                  })()}
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="w-2 h-2 bg-[#0D9488] rounded-full"></div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold">START POINT</p>
                        <p className="font-bold text-slate-800">Connaught Place, Delhi</p>
                      </div>
                    </div>
                    <div className="px-4 py-8 flex justify-center">
                      <div className="w-0.5 h-16 bg-gradient-to-b from-[#0D9488] to-emerald-400"></div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold">END POINT</p>
                        <p className="font-bold text-slate-800">IGI Airport, Delhi</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-bold text-blue-900">Total Distance: 25.5 km | Estimated Time: 45 mins</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold mb-2">ROUTE NAME</p>
                    <p className="text-lg font-black text-slate-800">CP to IGI</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold mb-2">ACTIVE STATUS</p>
                    <p className="text-lg font-black text-green-600">✓ Active</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold mb-2">DAILY TRIPS AVG</p>
                    <p className="text-lg font-black text-slate-800">8-12</p>
                  </div>
                  <button
                    onClick={() => {
                      const route = driver?.route;
                      if (!route) return;
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&origin=${route.startLat},${route.startLng}&destination=${route.endLat},${route.endLng}`,
                        '_blank',
                      );
                    }}
                    disabled={!driver?.route}
                    className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    View on Map
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* EARNINGS SECTION */}
          {activeSection === 'earnings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800">Earnings</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
                  <p className="text-xs text-green-700 font-bold mb-2">TODAY'S EARNINGS</p>
                  <p className="text-3xl font-black text-green-600">₹{stats.todayEarnings}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
                  <p className="text-xs text-blue-700 font-bold mb-2">THIS WEEK</p>
                  <p className="text-3xl font-black text-blue-600">₹{stats.thisWeekEarnings}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
                  <p className="text-xs text-purple-700 font-bold mb-2">THIS MONTH</p>
                  <p className="text-3xl font-black text-purple-600">₹{stats.thisMonthEarnings}</p>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-black text-slate-800 mb-4">Earnings Breakdown</h3>
                <div className="space-y-3">
                  {(() => {
                    const done = rideHistory.filter((r) => r.status === 'Completed');
                    const total = done.reduce((sum, r) => sum + (r.fare ?? 0), 0);
                    const km = done.reduce((sum, r) => sum + (r.distanceKm ?? 0), 0);
                    const rows = [
                      { label: 'Total fares collected', note: `From ${done.length} completed rides`, value: inr(total), color: 'text-slate-800' },
                      { label: 'Average per ride', note: 'Fare per completed ride', value: inr(done.length ? total / done.length : 0), color: 'text-emerald-600' },
                      { label: 'Distance covered', note: 'With passengers on board', value: `${km.toFixed(1)} km`, color: 'text-orange-600' },
                    ];
                    return rows.map((row) => (
                      <div key={row.label} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-bold text-slate-800">{row.label}</p>
                          <p className="text-xs text-slate-500">{row.note}</p>
                        </div>
                        <p className={`text-xl font-black ${row.color}`}>{row.value}</p>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Payout Info */}
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl border border-teal-200 p-6">
                <h3 className="font-bold text-slate-800 mb-3">Next Payout</h3>
                <p className="text-2xl font-black text-teal-600 mb-2">₹{stats.thisWeekEarnings}</p>
                <p className="text-sm text-slate-600 mb-4">Available for payout on Monday</p>
                <button className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition-all">
                  Request Early Payout
                </button>
              </div>
            </div>
          )}

          {/* PROFILE SECTION */}
          {activeSection === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800">My Profile</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Personal Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 font-bold mb-1">FULL NAME</p>
                        <p className="text-lg font-bold text-slate-800">{driver?.user?.name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold mb-1">EMAIL</p>
                        <p className="text-lg font-bold text-slate-800">{(driver?.user as { email?: string })?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold mb-1">PHONE</p>
                        <p className="text-lg font-bold text-slate-800">{driver?.user?.phone || 'N/A'}</p>
                      </div>
                      <button className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-all mt-4">
                        Edit Profile
                      </button>
                    </div>
                  </div>

                  {/* Vehicle Information */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                      <Car className="w-5 h-5" />
                      Vehicle Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 font-bold mb-1">LICENSE PLATE</p>
                        <p className="text-lg font-bold text-slate-800">{driver?.vehicle?.licensePlate || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold mb-1">VEHICLE TYPE</p>
                        <p className="text-lg font-bold text-slate-800">Auto Rickshaw</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-bold mb-1">REGISTRATION</p>
                        <p className="text-lg font-bold text-slate-800">Valid till Dec 2026</p>
                      </div>
                      <button className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-all mt-4">
                        Update Vehicle
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stats Sidebar */}
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6 text-center">
                    <Star className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-3xl font-black text-amber-600">{stats.rating}</p>
                    <p className="text-xs text-amber-700 font-bold mt-1">({stats.reviewCount} reviews)</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6 text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-3xl font-black text-green-600">{stats.completedRides}</p>
                    <p className="text-xs text-green-700 font-bold mt-1">Completed Rides</p>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                    <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-3xl font-black text-slate-800">2.5 yrs</p>
                    <p className="text-xs text-slate-600 font-bold mt-1">Member Since</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS SECTION */}
          {activeSection === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800">Settings</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* App Settings */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-black text-slate-800 mb-4">App Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-bold text-slate-800">Push Notifications</p>
                        <p className="text-xs text-slate-600">Get ride alerts</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-bold text-slate-800">SMS Notifications</p>
                        <p className="text-xs text-slate-600">Important updates via SMS</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-bold text-slate-800">Sound Effects</p>
                        <p className="text-xs text-slate-600">Play notification sounds</p>
                      </div>
                      <input type="checkbox" defaultChecked className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Preferences */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-black text-slate-800 mb-4">Preferences</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-2">Language</label>
                      <select className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D9488]">
                        <option>English</option>
                        <option>Hindi</option>
                        <option>Marathi</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-800 mb-2">Theme</label>
                      <select className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D9488]">
                        <option>Light</option>
                        <option>Dark</option>
                        <option>Auto</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Support */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-black text-slate-800 mb-4">Support</h3>
                  <div className="space-y-3">
                    <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-all text-sm flex items-center justify-center gap-2">
                      <Phone className="w-4 h-4" />
                      Contact Support
                    </button>
                    <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-all text-sm">
                      Help Center
                    </button>
                    <button className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg transition-all text-sm">
                      Report an Issue
                    </button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-50 rounded-xl border border-red-200 p-6">
                  <h3 className="font-black text-red-900 mb-4">Danger Zone</h3>
                  <div className="space-y-3">
                    <button
                      onClick={async () => {
                        if (confirm('Delete all accepted but incomplete rides? This cannot be undone.')) {
                          try {
                            await api.post('/rides/cleanup/accepted');
                            toast({ title: 'Success', description: 'Accepted rides deleted successfully' });
                            fetchDriverData();
                          } catch (err: any) {
                            toast({ title: 'Error', description: err.response?.data?.message || 'Failed to cleanup rides', variant: 'destructive' });
                          }
                        }
                      }}
                      className="w-full px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold rounded-lg transition-all text-sm"
                    >
                      Clean Accepted Rides
                    </button>
                    <button className="w-full px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-lg transition-all text-sm">
                      Deactivate Account
                    </button>
                    <button
                      onClick={() => {
                        localStorage.clear();
                        navigate('/login');
                      }}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all text-sm"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
