import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRides = async () => {
    if (!user?.driver?.id) return;
    try {
      const res = await api.get(`/rides/driver/${user.driver.id}/all`);
      setRides(res.data.history || []);
    } catch (err) {
      console.error("Failed to load rides", err);
    }
  };

  useEffect(() => {
    fetchRides();
    const interval = setInterval(fetchRides, 5000);
    return () => clearInterval(interval);
  }, []);

  const acceptRide = async (rideId: string) => {
    if (!user?.driver?.id) return;
    setLoading(true);
    try {
      await api.post('/rides/accept', { rideId, driverId: user.driver.id });
      toast({ title: "Success", description: "Ride Accepted!" });
      fetchRides();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to accept ride", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const completeRide = async (rideId: string) => {
    setLoading(true);
    try {
      await api.post('/rides/complete', { rideId });
      toast({ title: "Success", description: "Ride Completed!" });
      fetchRides();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to complete ride", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  // Only show active rides (Requested or Accepted)
  const activeRides = rides.filter(r => r.status === 'Requested' || r.status === 'Accepted');

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Driver Dashboard</h1>
        <Button onClick={logout} variant="outline">Logout</Button>
      </div>
      <p>Welcome, {user.name || 'Driver'}!</p>
      
      <div className="p-6 bg-white shadow rounded-lg border">
        <h2 className="text-xl font-semibold mb-4">Incoming & Active Rides</h2>
        {!user?.driver?.id && (
          <p className="text-red-500 mb-4">Error: No driver profile found for your account. Please log in with a seeded driver number (e.g. +918888000001).</p>
        )}
        
        {activeRides.length === 0 ? (
          <p className="text-gray-500 text-sm">No active ride requests right now. Waiting for passengers...</p>
        ) : (
          <div className="space-y-4">
            {activeRides.map(ride => (
              <Card key={ride.id}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <p><strong>Status:</strong> {ride.status}</p>
                    <p className="text-sm text-gray-500">Passenger ID: {ride.passengerId}</p>
                    <p className="text-sm text-gray-500">Pickup: {ride.pickupLat}, {ride.pickupLng}</p>
                  </div>
                  <div>
                    {ride.status === 'Requested' && (
                      <Button disabled={loading} onClick={() => acceptRide(ride.id)}>Accept</Button>
                    )}
                    {ride.status === 'Accepted' && (
                      <Button variant="secondary" disabled={loading} onClick={() => completeRide(ride.id)}>Complete</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}