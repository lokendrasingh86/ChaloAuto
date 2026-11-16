import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { socket } from '@/lib/socket';
import MapView, { type MapLine, type MapMarker } from '@/components/MapView';
import RatingDialog from '@/components/RatingDialog';
import { estimateFare, inr, type LatLng } from '@/lib/geo';
import { Car, Clock, Loader, Map, MapPin, Navigation, Phone, Users } from 'lucide-react';

type Stage = 'plan' | 'searching' | 'matched' | 'accepted';

interface Completed {
  rideId: string;
  fare: number;
  distanceKm: number;
  driverName?: string | null;
}

const num = (s: string): number | null => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export default function FindRides() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [routes, setRoutes] = useState<any[]>([]);
  const [pLat, setPLat] = useState('');
  const [pLng, setPLng] = useState('');
  const [dLat, setDLat] = useState('');
  const [dLng, setDLng] = useState('');
  const [picking, setPicking] = useState<'pickup' | 'drop'>('pickup');

  const [stage, setStage] = useState<Stage>('plan');
  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const [pooled, setPooled] = useState(false);
  const [fare, setFare] = useState<number | null>(null);
  const [message, setMessage] = useState('Finding the best auto for you...');
  const [loading, setLoading] = useState(false);

  const [completed, setCompleted] = useState<Completed | null>(null);
  const [rating, setRating] = useState(false);

  const rideRef = useRef<any>(null);
  rideRef.current = ride;

  const pickup: LatLng | null = num(pLat) !== null && num(pLng) !== null ? [num(pLat)!, num(pLng)!] : null;
  const drop: LatLng | null = num(dLat) !== null && num(dLng) !== null ? [num(dLat)!, num(dLng)!] : null;
  const estimate = pickup && drop ? estimateFare(pickup, drop) : null;

  const setPickupPoint = (lat: number, lng: number) => {
    setPLat(lat.toFixed(5));
    setPLng(lng.toFixed(5));
  };
  const setDropPoint = (lat: number, lng: number) => {
    setDLat(lat.toFixed(5));
    setDLng(lng.toFixed(5));
  };

  const reset = () => {
    setStage('plan');
    setRide(null);
    setDriver(null);
    setDriverPos(null);
    setPooled(false);
    setFare(null);
  };

  // Load routes for the map, and resume an active ride if there is one.
  useEffect(() => {
    api.get('/routes').then((res) => setRoutes(res.data || [])).catch(() => undefined);

    if (!user?.id) return;
    api
      .get(`/rides/passenger/${user.id}/current`)
      .then((res) => {
        const current = res.data.currentRides?.[0];
        if (!current) return;
        setRide(current);
        setPickupPoint(current.pickupLat, current.pickupLng);
        if (current.dropLat != null) setDropPoint(current.dropLat, current.dropLng);
        setFare(current.fare ?? null);
        if (current.driver) {
          setDriver({
            name: current.driver.user?.name,
            phone: current.driver.user?.phone,
            licenseNumber: current.driver.licenseNumber,
            vehicle: current.driver.vehicle ? `${current.driver.vehicle.make} ${current.driver.vehicle.model}` : null,
          });
          setDriverPos([current.driver.currentLocationLat, current.driver.currentLocationLng]);
        }
        setStage(current.status === 'Accepted' ? 'accepted' : current.driverId ? 'matched' : 'searching');
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time updates.
  useEffect(() => {
    if (!user?.id) return;

    const mine = (data: any) => !data?.rideId || !rideRef.current || data.rideId === rideRef.current.id;

    const onMatched = (data: any) => {
      if (!mine(data)) return;
      setDriver(data.driver);
      setPooled(!!data.pooled);
      if (data.fare != null) setFare(data.fare);
      setStage('matched');
      setMessage('Auto found! Waiting for the driver to confirm...');
    };
    const onUnmatched = (data: any) => {
      if (!mine(data)) return;
      setDriver(null);
      setStage('searching');
      setMessage(`${data?.reason || 'Driver unavailable'}. Looking for another auto...`);
    };
    const onAccepted = (data: any) => {
      if (!mine(data)) return;
      setDriver(data.driver);
      if (data.driver?.lat != null) setDriverPos([data.driver.lat, data.driver.lng]);
      setPooled(!!data.pooled);
      if (data.fare != null) setFare(data.fare);
      setStage('accepted');
      toast({ title: 'Driver accepted!', description: `${data.driver?.name || 'Your driver'} is on the way.` });
    };
    const onLocation = (data: any) => {
      if (!mine(data)) return;
      setDriverPos([data.lat, data.lng]);
    };
    const onCompleted = (data: any) => {
      if (!mine(data)) return;
      setCompleted({
        rideId: data.rideId,
        fare: data.fare,
        distanceKm: data.distanceKm,
        driverName: data.driver?.name,
      });
      reset();
    };
    const onCancelled = (data: any) => {
      if (!mine(data)) return;
      reset();
      toast({
        title: 'Ride cancelled',
        description: data?.reason || 'The ride was cancelled.',
        variant: 'destructive',
      });
    };

    socket.connect();
    socket.on('rideMatched', onMatched);
    socket.on('rideUnmatched', onUnmatched);
    socket.on('rideAccepted', onAccepted);
    socket.on('driverLocationUpdate', onLocation);
    socket.on('rideCompleted', onCompleted);
    socket.on('rideCancelled', onCancelled);

    return () => {
      socket.off('rideMatched', onMatched);
      socket.off('rideUnmatched', onUnmatched);
      socket.off('rideAccepted', onAccepted);
      socket.off('driverLocationUpdate', onLocation);
      socket.off('rideCompleted', onCompleted);
      socket.off('rideCancelled', onCancelled);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const requestRide = async () => {
    if (!pickup || !drop) {
      toast({ title: 'Choose both points', description: 'Set a pickup and a drop-off on the map.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/rides/request', {
        pickupLat: pickup[0],
        pickupLng: pickup[1],
        dropLat: drop[0],
        dropLng: drop[1],
      });
      const created = res.data.ride;
      setRide(created);
      setFare(created.fare ?? null);
      setPickupPoint(created.pickupLat, created.pickupLng);
      setDropPoint(created.dropLat, created.dropLng);
      setMessage(`On route: ${created.routeName}. Finding the best auto for you...`);
      setStage('searching');
    } catch (err: any) {
      toast({
        title: 'Could not request ride',
        description: err.response?.data?.error || err.response?.data?.message || 'Failed to request ride',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelRequest = async () => {
    if (!ride) return reset();
    try {
      await api.post('/rides/cancel', { rideId: ride.id });
      reset();
      toast({ title: 'Ride cancelled' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.error || 'Failed to cancel', variant: 'destructive' });
    }
  };

  const submitRating = async (stars: number, comment: string) => {
    if (!completed) return;
    setRating(true);
    try {
      await api.post('/rides/rate', { rideId: completed.rideId, rating: stars, comment });
      toast({ title: 'Thanks for rating!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.error || 'Could not save rating', variant: 'destructive' });
    } finally {
      setRating(false);
      setCompleted(null);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Location not supported', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickupPoint(pos.coords.latitude, pos.coords.longitude);
        setPicking('drop');
      },
      () => toast({ title: 'Could not get your location', description: 'Tap the map instead.', variant: 'destructive' }),
    );
  };

  const onMapClick = (lat: number, lng: number) => {
    if (stage !== 'plan') return;
    if (picking === 'pickup') {
      setPickupPoint(lat, lng);
      setPicking('drop');
    } else {
      setDropPoint(lat, lng);
    }
  };

  const lines: MapLine[] = useMemo(
    () =>
      routes
        .filter((r) => r.points?.length > 1)
        .map((r) => ({
          id: r.id,
          points: [...r.points].sort((a: any, b: any) => a.sequence - b.sequence).map((p: any): LatLng => [p.lat, p.lng]),
          color: '#14B8A6',
          weight: 3,
        })),
    [routes],
  );

  const markers: MapMarker[] = [];
  if (pickup) {
    markers.push({
      id: 'pickup',
      lat: pickup[0],
      lng: pickup[1],
      kind: 'pickup',
      label: 'A',
      draggable: stage === 'plan',
      onDragEnd: setPickupPoint,
    });
  }
  if (drop) {
    markers.push({
      id: 'drop',
      lat: drop[0],
      lng: drop[1],
      kind: 'drop',
      label: 'B',
      draggable: stage === 'plan',
      onDragEnd: setDropPoint,
    });
  }
  if (driverPos) markers.push({ id: 'driver', lat: driverPos[0], lng: driverPos[1], kind: 'driver' });

  const inputCls =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-[#0D9488] focus:outline-none disabled:bg-slate-50';

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-800">
      <aside className="hidden w-64 flex-col border-r bg-white lg:flex">
        <div className="flex items-center gap-2 border-b px-6 py-5">
          <div className="rounded-lg bg-[#E0F2FE] p-1.5">
            <Map className="h-6 w-6 text-[#0D9488]" />
          </div>
          <span className="text-2xl font-extrabold text-[#0D9488]">ChaloAuto</span>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-4">
          {[
            { label: 'Dashboard', path: '/passenger' },
            { label: 'Find Rides', path: '/find-rides', active: true },
            { label: 'My Bookings', path: '/bookings' },
            { label: 'Profile', path: '/profile' },
            { label: 'Help & Support', path: '/help' },
            { label: 'Simulation', path: '/simulation' },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                item.active
                  ? 'bg-[#ECFDF5] text-[#0D9488]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-6 py-4 md:px-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Find Rides</h1>
            <p className="text-sm text-slate-500">Pick your pickup and drop-off and we will match you with a shared auto.</p>
          </div>
          <button
            onClick={() => navigate('/passenger')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            Back to Dashboard
          </button>
        </header>

        <div className="grid flex-1 gap-6 overflow-y-auto p-4 md:p-8 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-2">
            {stage === 'plan' && (
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-slate-800">
                  <MapPin className="h-5 w-5 text-[#0D9488]" /> Where to?
                </h2>
                <p className="mb-4 text-sm text-slate-500">Tap the map to set points, or drag the markers. Teal lines are auto routes.</p>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  {(['pickup', 'drop'] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setPicking(k)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                        picking === k ? 'border-[#0D9488] bg-[#ECFDF5] text-[#0D9488]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {k === 'pickup' ? 'A · Pickup' : 'B · Drop-off'}
                    </button>
                  ))}
                </div>

                <button onClick={useMyLocation} className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#0D9488] hover:underline">
                  <Navigation className="h-4 w-4" /> Use my current location as pickup
                </button>

                <details className="mb-4 text-sm">
                  <summary className="cursor-pointer font-semibold text-slate-500">Enter coordinates manually</summary>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <input className={inputCls} value={pLat} onChange={(e) => setPLat(e.target.value)} placeholder="Pickup lat" />
                    <input className={inputCls} value={pLng} onChange={(e) => setPLng(e.target.value)} placeholder="Pickup lng" />
                    <input className={inputCls} value={dLat} onChange={(e) => setDLat(e.target.value)} placeholder="Drop lat" />
                    <input className={inputCls} value={dLng} onChange={(e) => setDLng(e.target.value)} placeholder="Drop lng" />
                  </div>
                </details>

                {estimate && (
                  <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Approx. distance</span>
                      <span className="font-semibold">{estimate.km.toFixed(1)} km</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-slate-500">Estimated fare</span>
                      <span className="font-bold text-[#0D9488]">{inr(estimate.solo)}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Share the auto with another passenger and pay about {inr(estimate.pooled)}.</p>
                  </div>
                )}

                <button
                  onClick={requestRide}
                  disabled={loading || !pickup || !drop}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D9488] py-3 font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-50"
                >
                  {loading && <Loader className="h-4 w-4 animate-spin" />}
                  {loading ? 'Requesting...' : 'Find Auto'}
                </button>
              </div>
            )}

            {(stage === 'searching' || stage === 'matched') && (
              <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-16 w-16 animate-bounce items-center justify-center rounded-full bg-slate-100">
                    <Clock className="h-8 w-8 text-[#0D9488]" />
                  </div>
                </div>
                <h2 className="mb-2 text-xl font-bold text-slate-800">
                  {stage === 'matched' ? 'Auto found' : 'Finding your auto'}
                </h2>
                <p className="mb-4 text-sm text-slate-500">{message}</p>
                {stage === 'matched' && driver && (
                  <div className="mb-4 rounded-lg border border-green-200 bg-[#ECFDF5] p-3 text-left text-sm">
                    <p className="font-bold text-green-900">{driver.name || 'Driver'}</p>
                    {pooled && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-green-700">
                        <Users className="h-3 w-3" /> Shared ride: pooled fare applied
                      </p>
                    )}
                  </div>
                )}
                {fare != null && <p className="mb-4 text-sm text-slate-500">Fare: <span className="font-bold text-[#0D9488]">{inr(fare)}</span></p>}
                <button onClick={cancelRequest} className="w-full rounded-lg bg-red-50 py-3 font-semibold text-red-600 transition-all hover:bg-red-100">
                  Cancel Request
                </button>
              </div>
            )}

            {stage === 'accepted' && (
              <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-[#ECFDF5] to-green-50 p-6 shadow-sm">
                <div className="mb-4 text-center">
                  <div className="text-4xl">✅</div>
                  <h2 className="mt-1 text-xl font-bold text-green-900">Driver accepted</h2>
                  <p className="text-sm text-green-700">Track your auto live on the map</p>
                </div>
                <div className="space-y-3 rounded-xl border border-green-200 bg-white p-4 text-sm">
                  <p className="text-lg font-bold text-slate-800">{driver?.name || 'Driver'}</p>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">{driver?.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Car className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">{driver?.vehicle || driver?.licenseNumber || 'Auto'}</span>
                  </div>
                  {pooled && (
                    <div className="flex items-center gap-3 text-green-700">
                      <Users className="h-4 w-4" /> <span className="font-semibold">Shared ride (pooled fare)</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-slate-500">Fare</span>
                    <span className="font-bold text-[#0D9488]">{inr(fare)}</span>
                  </div>
                </div>
                <button onClick={cancelRequest} className="mt-4 w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                  Cancel ride
                </button>
              </div>
            )}
          </div>

          <div className="xl:col-span-3">
            <MapView markers={markers} lines={lines} onMapClick={onMapClick} height={520} fit />
          </div>
        </div>
      </main>

      {completed && (
        <RatingDialog
          fare={completed.fare}
          distanceKm={completed.distanceKm}
          driverName={completed.driverName}
          submitting={rating}
          onSubmit={submitRating}
          onSkip={() => setCompleted(null)}
        />
      )}
    </div>
  );
}
