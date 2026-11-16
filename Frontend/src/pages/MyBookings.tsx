import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import RatingDialog from '@/components/RatingDialog';
import { inr } from '@/lib/geo';
import {
  Map, Calendar, CheckCircle2, XCircle, Clock, User,
  Phone, Car, MapPin, Loader, Star, Users
} from 'lucide-react';

export default function MyBookings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateTarget, setRateTarget] = useState<any>(null);
  const [rateBusy, setRateBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled' | 'pending'>('all');

  const fetchBookings = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const response = await api.get(`/rides/passenger/${user.id}/history`);
      setBookings(response.data.history || []);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to load bookings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user?.id]);

  const submitRating = async (stars: number, comment: string) => {
    if (!rateTarget) return;
    setRateBusy(true);
    try {
      await api.post('/rides/rate', { rideId: rateTarget.id, rating: stars, comment });
      toast({ title: 'Thanks for rating!' });
      setRateTarget(null);
      fetchBookings();
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.error || 'Could not save rating', variant: 'destructive' });
    } finally {
      setRateBusy(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'Cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'Cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === 'all') return true;
    return booking.status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="flex bg-[#F8FAFC] min-h-screen font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r hidden lg:flex flex-col">
        <div className="px-6 py-5 flex items-center gap-2 border-b">
          <div className="bg-[#E0F2FE] p-1.5 rounded-lg"><Map className="w-6 h-6 text-[#0D9488]"/></div>
          <span className="text-2xl font-extrabold text-[#0D9488]">ChaloAuto</span>
        </div>
        <nav className="flex-1 px-4 space-y-1 mt-4">
          {[
            { label: 'Dashboard', path: '/passenger' },
            { label: 'Find Rides', path: '/find-rides' },
            { label: 'My Bookings', path: '/bookings', active: true },
            { label: 'Profile', path: '/profile' },
            { label: 'Help & Support', path: '/help' },
            { label: 'Simulation', path: '/simulation' },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen">
        <header className="bg-white px-8 py-4 border-b flex justify-between items-center">
          <h1 className="text-2xl font-bold">My Bookings</h1>
          <button onClick={() => navigate('/passenger')} className="text-slate-500 hover:text-slate-700 text-sm font-semibold">Back to Dashboard</button>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {/* Filters */}
          <div className="mb-6 flex gap-3 flex-wrap">
            {['all', 'pending', 'completed', 'cancelled'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  filter === f
                    ? 'bg-[#0D9488] text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Bookings List */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="w-8 h-8 animate-spin text-[#0D9488]" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No bookings found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-4 flex-1">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 shrink-0">
                        {getStatusIcon(booking.status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-slate-800">Ride #{booking.id.slice(-8)}</h3>
                          <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(booking.createdAt).toLocaleDateString()} at {new Date(booking.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  </div>

                  {booking.driver && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 font-bold mb-1">Driver</p>
                          <p className="font-semibold text-slate-800 text-sm flex items-center gap-1">
                            <User className="w-4 h-4" /> {booking.driver.user?.name || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-bold mb-1">Phone</p>
                          <p className="font-semibold text-slate-800 text-sm flex items-center gap-1">
                            <Phone className="w-4 h-4" /> {booking.driver.user?.phone || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-bold mb-1">Vehicle</p>
                          <p className="font-semibold text-slate-800 text-sm flex items-center gap-1">
                            <Car className="w-4 h-4" /> {booking.driver.vehicle?.licensePlate || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-bold mb-1">Route</p>
                          <p className="font-semibold text-slate-800 text-sm">{booking.route?.name || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="w-4 h-4" />
                    <span>Pickup: {booking.pickupLat?.toFixed(4)}, {booking.pickupLng?.toFixed(4)}</span>
                  </div>
                  {booking.dropLat != null && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      <MapPin className="w-4 h-4 text-red-400" />
                      <span>Drop-off: {booking.dropLat?.toFixed(4)}, {booking.dropLng?.toFixed(4)}</span>
                    </div>
                  )}
                  {booking.fare != null && (
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
                      <div className="text-sm text-slate-600 flex items-center gap-3">
                        <span className="font-bold text-[#0D9488]">{inr(booking.fare)}</span>
                        {booking.distanceKm != null && <span>{Number(booking.distanceKm).toFixed(1)} km</span>}
                        {booking.poolId && <span className="flex items-center gap-1 text-xs"><Users className="w-3 h-3" /> shared</span>}
                      </div>
                      {booking.status === 'Completed' && (
                        booking.rating ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-amber-500">
                            <Star className="w-4 h-4 fill-amber-400" /> {booking.rating}/5
                          </span>
                        ) : (
                          <button onClick={() => setRateTarget(booking)} className="text-sm font-semibold text-[#0D9488] hover:underline">
                            Rate this ride
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {rateTarget && (
        <RatingDialog
          fare={rateTarget.fare}
          distanceKm={rateTarget.distanceKm}
          driverName={rateTarget.driver?.user?.name}
          submitting={rateBusy}
          onSubmit={submitRating}
          onSkip={() => setRateTarget(null)}
        />
      )}
    </div>
  );
}
