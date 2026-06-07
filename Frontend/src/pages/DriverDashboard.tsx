import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { socket } from '@/lib/socket';
import { 
  Home, Map, Calendar, Wallet, User, HelpCircle, 
  Settings, Bell, ChevronDown, MoveRight,
  TrendingUp, CircleDollarSign, CalendarDays, Star, Car,
  Power, PowerOff, CarFront, FileText, CheckCircle2,
  XCircle, Clock
} from 'lucide-react';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [rides, setRides] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(false);

  const fetchProfileAndRides = async () => {
    if (!user?.id) return;
    try {
      const [profileRes, ridesRes] = await Promise.all([
        api.get(`/users/${user.id}`),
        api.get(`/rides/driver/${user.driver?.id || JSON.parse(localStorage.getItem('user') || '{}').driver?.id}/all`)
      ]);
      setProfile(profileRes.data);
      setIsOnline(profileRes.data.driver?.isAvailable || false);
      setRides(ridesRes.data.history || []);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    }
  };

  useEffect(() => {
    if (user.id && user.driver?.id) {
      fetchProfileAndRides();

      socket.connect();
      socket.emit('joinRoom', user.driver.id);

      socket.on('newRideRequest', (data) => {
        toast({ title: "New Ride Request!", description: `Pickup: ${data.pickupLat}, ${data.pickupLng}` });
        fetchProfileAndRides();
      });

      socket.on('rideCompleted', () => {
        toast({ title: "Ride Completed", description: "Great job!" });
        fetchProfileAndRides();
      });
      
      const interval = setInterval(fetchProfileAndRides, 5000);
      return () => {
        clearInterval(interval);
        socket.off('newRideRequest');
        socket.off('rideCompleted');
        socket.disconnect();
      }
    }
  }, [user.id, toast]);

  const toggleOnlineStatus = async () => {
    if (!user?.driver?.id) return;
    try {
      const newStatus = !isOnline;
      await api.post('/rides/driver/availability', { driverId: user.driver.id, isAvailable: newStatus });
      setIsOnline(newStatus);
      toast({ title: newStatus ? "You are Online" : "You are Offline", description: newStatus ? "You can now receive ride requests." : "You will not receive new requests." });
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const acceptRide = async (rideId: string) => {
    if (!user?.driver?.id) return;
    setLoading(true);
    try {
      await api.post('/rides/accept', { rideId, driverId: user.driver.id });
      toast({ title: "Success", description: "Ride Accepted!" });
      fetchProfileAndRides();
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
      fetchProfileAndRides();
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

  const navItems = [
    { icon: Home, label: 'Dashboard', active: true },
    { icon: Map, label: 'My Rides' },
    { icon: CircleDollarSign, label: 'Earnings' },
    { icon: Calendar, label: 'Bookings' },
    { icon: User, label: 'Passengers' },
    { icon: Wallet, label: 'Wallet' },
    { icon: Car, label: 'Vehicle' },
    { icon: User, label: 'Profile' },
    { icon: HelpCircle, label: 'Help & Support' },
    { icon: Settings, label: 'Settings', onClick: logout },
  ];
  
  const completedRidesCount = rides.filter(r => r.status === 'Completed').length;
  const cancelledRidesCount = rides.filter(r => r.status === 'Cancelled').length;
  // Approximated earning logic just for UI visual if empty
  const earnings = completedRidesCount * 70;
  
  const activeRides = rides.filter(r => r.status === 'Requested' || r.status === 'Accepted');
  const pastRides = rides.filter(r => r.status === 'Completed' || r.status === 'Cancelled').slice(0, 5);

  return (
    <div className="flex bg-[#F8FAFC] min-h-screen font-sans text-slate-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r hidden lg:flex flex-col">
        <div className="px-6 py-5 flex items-center gap-2 border-b border-transparent">
            <span className="text-2xl font-extrabold text-[#0D9488] flex items-center gap-2">
               <div className="bg-[#E0F2FE] p-1.5 rounded-lg"><Map className="w-6 h-6 text-[#0D9488]"/></div>
               ChaloAuto
            </span>
        </div>
        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          {navItems.map((item, i) => (
            <button
              key={i}
              onClick={item.onClick}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                item.active 
                  ? 'bg-[#ECFDF5] text-[#0D9488]' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
              }`}
            >
              <item.icon className={`w-5 h-5 ${item.active ? 'text-[#0D9488]' : ''}`} />
              {item.label}
            </button>
          ))}
        </nav>
        
        <div className="p-4 mt-auto">
            <div className="border border-slate-200 p-4 rounded-2xl bg-white shadow-sm mb-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</h4>
                <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className={`font-bold text-sm ${isOnline ? 'text-green-700' : 'text-red-700'}`}>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
                <p className="text-[10px] text-slate-500 mb-4">{isOnline ? 'You are visible to passengers' : 'You are currently hidden'}</p>
                <button 
                  onClick={toggleOnlineStatus}
                  className={`w-full py-2 rounded-xl text-xs font-bold border-2 transition-colors ${isOnline ? 'border-red-100 text-red-600 hover:bg-red-50' : 'border-green-100 text-green-600 hover:bg-green-50' }`}>
                    {isOnline ? 'Go Offline' : 'Go Online'}
                </button>
            </div>
            
            <div className="bg-[#E0EEFF] p-4 rounded-2xl relative overflow-hidden">
                <h4 className="font-bold text-slate-800 text-xs mb-1 relative z-10 w-full">More rides, <br/>More earnings!</h4>
                <p className="text-[10px] text-slate-600 mb-4 relative z-10 w-full mt-2 pr-8">Keep accepting rides<br/>and earn more.</p>
                <div className="absolute right-0 bottom-0 text-5xl translate-x-2 translate-y-2 drop-shadow-md">
                   🛺
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white px-8 py-4 border-b flex justify-end items-center shrink-0">
          <div className="flex items-center gap-6">
            <button className="relative p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button className="flex items-center gap-3 pl-6 border-l group hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-full overflow-hidden flex justify-center items-center font-bold text-sm bg-blue-100 text-blue-700 shadow-inner">
                {user?.name?.charAt(0) || 'D'}
              </div>
              <div className="hidden md:flex flex-col items-start pr-2">
                  <span className="text-sm font-semibold leading-tight">{user?.name || 'Driver'}</span>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-500 mt-0.5"><Star className="w-3 h-3 fill-amber-500"/> 4.8</div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
            </button>
          </div>
        </header>

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          
          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-extrabold mb-1">Hello, {user?.name || 'Driver'}! 👋</h1>
            <p className="text-slate-500 text-sm font-medium">Have a great day and drive safe.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="bg-white border text-center md:text-left border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-center">
               <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                 <div className="bg-[#ECFDF5] p-1.5 rounded-lg text-[#0D9488]"><Wallet className="w-4 h-4"/></div>
                 <span className="text-xs font-bold text-slate-600">Today's Earnings</span>
               </div>
               <span className="text-2xl font-black text-slate-800">₹{earnings}</span>
               <span className="text-[10px] font-bold text-green-600 mt-2 flex items-center justify-center md:justify-start gap-1"><TrendingUp className="w-3 h-3"/> 12% from yesterday</span>
            </div>
            
            <div className="bg-white border text-center md:text-left border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-center">
               <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                 <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600"><TrendingUp className="w-4 h-4"/></div>
                 <span className="text-xs font-bold text-slate-600">This Week Earnings</span>
               </div>
               <span className="text-2xl font-black text-slate-800">₹{earnings * 3 + 240}</span>
               <span className="text-[10px] font-bold text-indigo-600 mt-2 flex items-center justify-center md:justify-start gap-1"><TrendingUp className="w-3 h-3"/> 8% from last week</span>
            </div>
            
            <div className="bg-white border text-center md:text-left border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-center">
               <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                 <div className="bg-blue-50 p-1.5 rounded-lg text-blue-600"><CalendarDays className="w-4 h-4"/></div>
                 <span className="text-xs font-bold text-slate-600">Today's Rides</span>
               </div>
               <span className="text-2xl font-black text-slate-800">{rides.length}</span>
               <div className="text-[10px] font-bold text-slate-500 mt-2 flex gap-3 justify-center md:justify-start">
                   <span>Completed: {completedRidesCount}</span>
                   <span>Cancelled: {cancelledRidesCount}</span>
               </div>
            </div>

            <div className="bg-white border text-center md:text-left border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-center">
               <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                 <div className="bg-amber-50 p-1.5 rounded-lg text-amber-500"><Star className="w-4 h-4"/></div>
                 <span className="text-xs font-bold text-slate-600">Rating</span>
               </div>
               <span className="text-2xl font-black text-slate-800">4.8</span>
               <span className="text-[10px] font-bold text-green-600 mt-2">(230 reviews)</span>
            </div>

            <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col justify-center bg-gradient-to-br from-[#F0FDF4] to-white relative overflow-hidden text-center md:text-left">
               <div className="flex items-center justify-center md:justify-start gap-2 mb-2 relative z-10">
                 <div className="bg-white p-1.5 rounded-lg border border-green-100 text-[#0D9488]"><CarFront className="w-4 h-4"/></div>
                 <span className="text-xs font-bold text-slate-600">Status</span>
               </div>
               <span className={`text-2xl font-black relative z-10 ${isOnline ? 'text-green-700' : 'text-red-600'}`}>{isOnline ? 'Online' : 'Offline'}</span>
               <span className="text-[10px] font-bold text-slate-500 mt-2 relative z-10">{isOnline ? 'You are receiving rides' : 'You are disconnected'}</span>
               <div className="absolute right-0 bottom-0 text-7xl opacity-5 translate-x-4 translate-y-4">🛺</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
             {/* Chart / Active Rides */}
             <div className="col-span-1 xl:col-span-6 flex flex-col gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1 relative overflow-hidden min-h-[300px]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex gap-4 items-center">
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Rides Info</p>
                                <h3 className="font-bold text-slate-800 text-lg">Active Requests</h3>
                            </div>
                        </div>
                    </div>
                    {activeRides.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 absolute inset-0">
                            <Clock className="w-8 h-8 mb-3 opacity-50" />
                            <p className="text-sm font-semibold">No active requests right now.</p>
                            <p className="text-xs">Waiting for passengers...</p>
                        </div>
                    ) : (
                        <div className="space-y-4 relative z-10">
                            {activeRides.map(ride => (
                            <div key={ride.id} className="border border-green-200 bg-[#F0FDF4] p-4 rounded-xl shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-xs font-bold text-green-800">Passenger ID: {ride.passengerId}</p>
                                        <p className="text-[10px] text-green-600 mt-0.5">Coords: {ride.pickupLat}, {ride.pickupLng}</p>
                                    </div>
                                    <span className="text-[10px] font-extrabold uppercase px-2 py-1 rounded bg-green-200 text-green-900 border border-green-300">
                                        {ride.status}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    {ride.status === 'Requested' && (
                                        <button disabled={loading} onClick={() => acceptRide(ride.id)} className="w-full bg-[#0D9488] hover:bg-teal-700 text-white font-bold py-2 rounded-lg text-sm shadow-sm transition">
                                            Accept Ride
                                        </button>
                                    )}
                                    {ride.status === 'Accepted' && (
                                        <button disabled={loading} onClick={() => completeRide(ride.id)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-sm shadow-sm transition">
                                            Mark Completed
                                        </button>
                                    )}
                                </div>
                            </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Upcoming Booking Placeholder */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative">
                   <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-slate-800 text-sm">Upcoming Booking</h3>
                     <button className="text-[#0D9488] text-xs font-bold hover:underline">View details</button>
                   </div>
                   <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-slate-50 border border-slate-100 p-4 rounded-xl gap-4">
                       <div className="flex gap-6">
                         <div className="flex flex-col">
                           <span className="font-black text-slate-800">07:00 PM</span>
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 mb-2">Today</span>
                           <span className="text-[10px] font-bold bg-[#ECFDF5] text-[#0D9488] px-2 py-0.5 rounded w-max">Upcoming</span>
                         </div>
                         <div className="flex flex-col justify-center">
                           <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-bold text-slate-700">Gota</span>
                              <MoveRight className="w-3 h-3 text-slate-400" />
                              <span className="text-xs font-bold text-slate-700">Railway Station</span>
                           </div>
                           <span className="text-[10px] font-semibold text-slate-500 mb-1">Passenger: Ankit Sharma</span>
                           <span className="text-[10px] font-semibold text-slate-500">2 Seats</span>
                         </div>
                       </div>
                       <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
                         <div className="flex flex-col sm:items-end">
                            <span className="font-black text-xl text-slate-800">₹90</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Estimated Fare</span>
                         </div>
                         <button className="border-2 border-slate-200 bg-white text-slate-600 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-lg mt-2 hover:bg-slate-50">Navigate</button>
                       </div>
                   </div>
                </div>
             </div>

             {/* Today's Rides */}
             <div className="col-span-1 xl:col-span-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full">
                <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-slate-800 text-lg">Recent Rides</h3>
                 <button className="text-[#0D9488] text-sm font-bold hover:underline">View all</button>
               </div>
               
               <div className="flex-1 overflow-auto space-y-0">
                  {pastRides.length > 0 ? Object.values(pastRides).map((ride, idx) => (
                    <div key={idx} className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0 group cursor-pointer hover:bg-slate-50 px-2 rounded-xl transition-colors">
                        <div className="flex gap-4">
                            <div className="w-14 items-center">
                                <span className="text-xs font-black text-slate-800 block">{new Date(ride.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="flex flex-col w-40 sm:w-60">
                                <div className="flex items-center gap-2 mb-1 overflow-hidden">
                                  <div className="w-1.5 h-1.5 bg-[#0D9488] rounded-full shrink-0"></div>
                                  <span className="text-xs font-bold text-slate-700 truncate">{ride.route?.name || `Route ${ride.routeId?.slice(-4)}`}</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500 truncate ml-3.5">Pass ID: {ride.passengerId?.slice(-6)}</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <span className="font-black text-slate-800 w-10 text-right">₹--</span>
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded w-20 text-center ${ride.status === 'Completed' ? 'bg-[#ECFDF5] text-[#0D9488]' : 'bg-red-50 text-red-600'}`}>{ride.status}</span>
                            <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90 hidden sm:block" />
                        </div>
                    </div>
                  )) : (
                     <div className="py-20 text-center text-slate-400">
                         <FileText className="w-8 h-8 opacity-20 mx-auto mb-2" />
                         <span className="text-xs font-semibold">No rides found in your history.</span>
                     </div>
                  )}
               </div>
               <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                   <button className="text-[#0D9488] text-xs font-bold w-full p-2 hover:bg-[#F0FDF4] rounded-lg transition-colors">View All Rides</button>
               </div>
             </div>
          </div>

          {/* Bottom Widgets */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-20">
             
             <div className="col-span-1 xl:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-slate-800 text-sm">Earnings Summary</h3>
                 <button className="text-[#0D9488] text-xs font-bold hover:underline">View all</button>
               </div>
               <div className="grid grid-cols-3 gap-4 mb-6">
                   <div>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">This Week</p>
                       <p className="text-2xl font-black text-[#0D9488]">₹{earnings * 3 + 240}</p>
                   </div>
                   <div>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">This Month</p>
                       <p className="text-2xl font-black text-slate-800">₹{earnings * 10 + 1200}</p>
                   </div>
                   <div>
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Earnings</p>
                       <p className="text-2xl font-black text-slate-800">₹{earnings * 30 + 45000}</p>
                   </div>
               </div>
               <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs font-medium text-slate-500 flex items-center gap-2">
                   <CircleDollarSign className="w-4 h-4 text-slate-400" />
                   Payouts are transferred every Monday
               </div>
             </div>

             <div className="col-span-1 xl:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-slate-800 text-sm">Quick Actions</h3>
               </div>
               <div className="grid grid-cols-5 gap-2">
                   <div className="flex flex-col items-center gap-2 cursor-pointer group">
                       <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all ${isOnline ? 'bg-red-50 border-red-100 text-red-500' : 'bg-[#F0FDF4] border-green-100 text-[#0D9488]'}`} onClick={toggleOnlineStatus}>
                           {isOnline ? <PowerOff className="w-5 h-5"/> : <Power className="w-5 h-5" />}
                       </div>
                       <span className="text-[10px] font-bold text-slate-600 text-center">{isOnline ? 'Go Offline' : 'Go Online'}</span>
                   </div>
                   <div className="flex flex-col items-center gap-2 cursor-pointer group">
                       <div className="w-14 h-14 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-center text-blue-500 group-hover:border-blue-200 transition-all">
                           <Car className="w-5 h-5"/>
                       </div>
                       <span className="text-[10px] font-bold text-slate-600 text-center">My Vehicle</span>
                   </div>
                   <div className="flex flex-col items-center gap-2 cursor-pointer group">
                       <div className="w-14 h-14 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-center text-purple-500 group-hover:border-purple-200 transition-all">
                           <Wallet className="w-5 h-5"/>
                       </div>
                       <span className="text-[10px] font-bold text-slate-600 text-center">Earnings</span>
                   </div>
                   <div className="flex flex-col items-center gap-2 cursor-pointer group">
                       <div className="w-14 h-14 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-center text-amber-500 group-hover:border-amber-200 transition-all">
                           <CalendarDays className="w-5 h-5"/>
                       </div>
                       <span className="text-[10px] font-bold text-slate-600 text-center">Bookings</span>
                   </div>
                   <div className="flex flex-col items-center gap-2 cursor-pointer group">
                       <div className="w-14 h-14 rounded-2xl border border-slate-100 bg-white shadow-sm flex items-center justify-center text-indigo-500 group-hover:border-indigo-200 transition-all">
                           <HelpCircle className="w-5 h-5"/>
                       </div>
                       <span className="text-[10px] font-bold text-slate-600 text-center">Help</span>
                   </div>
               </div>
             </div>

          </div>

        </div>
      </main>
    </div>
  );
}