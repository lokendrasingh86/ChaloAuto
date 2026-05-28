import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { socket } from '@/lib/socket';

export default function PassengerDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [lat, setLat] = useState<string>('28.6304');
  const [lng, setLng] = useState<string>('77.2177');
  const [loading, setLoading] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [driverDetails, setDriverDetails] = useState<any>(null);

  useEffect(() => {
    if (user.id) {
      socket.connect();
      socket.emit('joinRoom', user.id);

      socket.on('rideAccepted', (data) => {
        setDriverDetails(data.driver);
        setActiveRide(prev => ({ ...prev, status: 'Accepted' }));
        toast({ title: "Ride Accepted!", description: `${data.driver.name} is on the way!` });
      });

      socket.on('rideCompleted', () => {
        setActiveRide(null);
        setDriverDetails(null);
        toast({ title: "Ride Completed", description: "You have arrived at your destination." });
      });

      socket.on('rideCancelled', () => {
        setActiveRide(null);
        setDriverDetails(null);
        toast({ title: "Ride Cancelled", description: "The ride has been cancelled.", variant: "destructive" });
      });
    }

    return () => {
      socket.off('rideAccepted');
      socket.off('rideCompleted');
      socket.off('rideCancelled');
      socket.disconnect();
    };
  }, [user.id, toast]);

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const requestRide = async () => {
    if (!lat || !lng) return toast({ title: "Error", description: "Please enter pickup coordinates", variant: "destructive" });
    
    setLoading(true);
    try {
      const res = await api.post('/rides/request', {
        passengerId: user.id,
        pickupLat: parseFloat(lat),
        pickupLng: parseFloat(lng)
      });
      setActiveRide(res.data.ride);
      toast({ title: "Success", description: "Ride requested successfully! Waiting for a driver." });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to request ride";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Passenger Dashboard</h1>
        <Button onClick={logout} variant="outline">Logout</Button>
      </div>
      <p>Welcome, {user.name || 'Passenger'}!</p>
      
      <div className="p-6 bg-white shadow rounded-lg border space-y-4">
        {activeRide ? (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-green-600">Ride Active</h2>
            <p><strong>Ride ID:</strong> {activeRide.id}</p>
            <p><strong>Status:</strong> {activeRide.status}</p>
            
            {driverDetails ? (
              <div className="mt-6 p-4 border rounded bg-slate-50">
                <h3 className="font-semibold text-lg mb-2">Driver Details</h3>
                <p><strong>Name:</strong> {driverDetails.name}</p>
                <p><strong>Phone:</strong> {driverDetails.phone}</p>
                <p><strong>Vehicle License:</strong> {driverDetails.licenseNumber}</p>
                <p><strong>Distance to Pickup:</strong> {driverDetails.distanceKm} km</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Wait for a driver to accept your ride via Socket.io or the Driver Dashboard.</p>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4">Request a Ride</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pickup Latitude</Label>
                <Input type="number" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 28.7041" />
              </div>
              <div className="space-y-2">
                <Label>Pickup Longitude</Label>
                <Input type="number" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 77.1025" />
              </div>
            </div>
            <Button onClick={requestRide} disabled={loading} className="w-full mt-4">
              {loading ? "Requesting..." : "Request Auto"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}