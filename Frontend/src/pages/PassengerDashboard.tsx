import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { socket } from '@/lib/socket';
import { 
  Home, Search, Calendar, Wallet, Bookmark, User, HelpCircle, 
  Settings, MapPin, ChevronDown, Bell, ArrowRightLeft, Clock,
  Ticket, Gift, Headset, Star, MoveRight, Map 
} from 'lucide-react';

export default function PassengerDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [lat, setLat] = useState<string>('28.6304');
  const [lng, setLng] = useState<string>('77.2177');
  const [loading, setLoading] = useState(false);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [driverDetails, setDriverDetails] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    if (!user.id) return;
    try {
      const [currentRes, historyRes, driversRes] = await Promise.all([
        api.get(`/rides/passenger/${user.id}/current`),
        api.get(`/rides/passenger/${user.id}/history`),
        api.get(`/users/drivers/available`)
      ]);
      
      const current = currentRes.data.currentRides[0];
      if (current) {
        setActiveRide(current);
        if (current.driver) {
          setDriverDetails({
            name: current.driver.user.name,
            phone: current.driver.user.phone,
            licenseNumber: current.driver.licenseNumber,
            distanceKm: "N/A"
          });
        }
      } else {
        setActiveRide(null);
        setDriverDetails(null);
      }
      
      setHistory(historyRes.data.history || []);
      setAvailableDrivers(driversRes.data.drivers || []);
    } catch (err: any) {
      console.error("Failed to fetch dashboard data", err);
    }
  };

  useEffect(() => {
    if (user.id) {
      fetchDashboardData();
      
      socket.connect();
      socket.emit('joinRoom', user.id);

      socket.on('rideAccepted', (data) => {
        setDriverDetails(data.driver);
        setActiveRide((prev: any) => ({ ...prev, status: 'Accepted' }));
        toast({ title: "Ride Accepted!", description: `${data.driver.name} is on the way!` });
        fetchDashboardData();
      });

      socket.on('rideCompleted', () => {
        setActiveRide(null);
        setDriverDetails(null);
        toast({ title: "Ride Completed", description: "You have arrived at your destination." });
        fetchDashboardData();
      });

      socket.on('rideCancelled', () => {
        setActiveRide(null);
        setDriverDetails(null);
        toast({ title: "Ride Cancelled", description: "The ride has been cancelled.", variant: "destructive" });
        fetchDashboardData();
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
      fetchDashboardData();
      toast({ title: "Success", description: "Ride requested successfully! Waiting for a driver." });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to request ride";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { icon: Home, label: 'Dashboard', active: true },
    { icon: Search, label: 'Find Rides' },
    { icon: Calendar, label: 'My Bookings' },
    { icon: Wallet, label: 'Wallet' },
    { icon: Bookmark, label: 'Saved Places' },
    { icon: User, label: 'Profile' },
    { icon: HelpCircle, label: 'Help & Support' },
    { icon: Settings, label: 'Settings', onClick: logout },
  ];

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
        <nav className="flex-1 px-4 space-y-1 mt-4">
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
        <div className="p-6">
          <div className="bg-[#F8FAFC] p-4 rounded-2xl relative overflow-hidden text-center border">
            <h4 className="font-bold text-slate-800 text-sm mb-1 relative z-10 w-full">Travel together</h4>
            <p className="font-bold text-[#0D9488] text-sm mb-3 relative z-10 w-full">Save together</p>
            <p className="text-xs text-slate-500 mb-4 relative z-10 w-full">Book your seat now!</p>
            <div className="flex justify-center relative z-10">
               <div className="w-24 h-16 bg-[#FEF3C7] rounded-xl flex items-center justify-center border-2 border-yellow-200">
                  <span className="text-3xl">🛺</span>
               </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white px-8 py-4 border-b flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
            <MapPin className="w-4 h-4 text-[#0D9488]" />
            <span className="text-sm font-semibold">Ahmedabad, Gujarat</span>
            <ChevronDown className="w-4 h-4 text-slate-400 ml-2" />
          </div>
          
          <div className="flex items-center gap-6">
            <button className="relative p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-colors">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button onClick={logout} title="Click to logout" className="flex items-center gap-3 pl-6 border-l group hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-full overflow-hidden flex justify-center items-center font-bold text-sm bg-blue-100 text-blue-700 shadow-inner">
                {user?.name?.charAt(0) || 'L'}
              </div>
              <span className="text-sm font-semibold hidden md:block">{user?.name || 'Lokii'}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
            </button>
          </div>
        </header>

        {/* Scrollable Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
          
          {/* Greeting */}
          <div>
            <h1 className="text-2xl font-extrabold mb-1">Hello, {user?.name || 'Lokii'}! 👋</h1>
            <p className="text-slate-500 text-sm font-medium">Where are you going today?</p>
          </div>

          {activeRide && (
             <div className="bg-[#ECFDF5] border border-green-200 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in zoom-in w-full">
                <div>
                   <h2 className="font-bold text-lg mb-1 text-green-900 flex items-center gap-2">
                     Ride Request Active! <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                   </h2>
                   <p className="text-sm text-green-700 font-medium">Status: {activeRide.status} (ID: {activeRide.id})</p>
                   {driverDetails && (
                       <div className="mt-3 bg-white/60 p-3 rounded-lg border border-green-200">
                         <p className="font-semibold text-green-900">Driver: {driverDetails.name} • {driverDetails.phone}</p>
                         <p className="text-xs text-green-800 font-medium mt-1">Vehicle Match: {driverDetails.licenseNumber} <span className="mx-2">•</span> Distance: {driverDetails.distanceKm} km</p>
                       </div>
                   )}
                </div>
                <div className="text-right w-full md:w-auto">
                   {!driverDetails ? (
                      <p className="animate-pulse font-bold text-green-700 bg-white/50 px-4 py-2 rounded-lg inline-block border border-green-100">Waiting for driver...</p>
                   ) : (
                      <div className="bg-white/60 p-3 rounded-lg border border-green-200 text-center">
                        <p className="text-xs text-green-800 font-bold uppercase tracking-wider mb-1">Pin To Share</p>
                        <p className="text-2xl font-extrabold text-green-900">{activeRide.id.toString().slice(-4).toUpperCase()}</p>
                      </div>
                   )}
                </div>
             </div>
          )}

          {/* Top Row Widgets */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* Search Widget */}
            <div className="col-span-1 xl:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row items-center gap-4 mb-5 relative">
                
                <div className="flex-1 w-full flex items-center bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-sm relative">
                  <div className="w-2 h-2 rounded-full bg-[#0D9488] shrink-0 mr-3"></div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 font-bold px-1 uppercase tracking-wider block">Pickup Latitude (From)</label>
                    <input 
                       value={lat} 
                       onChange={e => setLat(e.target.value)} 
                       className="bg-transparent border-none outline-none text-sm font-semibold w-full px-1 text-slate-800"
                    />
                  </div>
                </div>

                <button className="w-10 h-10 bg-white border border-slate-200 shadow-sm rounded-full flex items-center justify-center shrink-0 md:absolute md:left-1/2 md:-translate-x-1/2 z-10 text-slate-400 hover:text-slate-700 hover:shadow-md transition-all">
                  <ArrowRightLeft className="w-4 h-4" />
                </button>

                <div className="flex-1 w-full flex items-center bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mr-3"></div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 font-bold px-1 uppercase tracking-wider block">Pickup Longitude (To)</label>
                    <input 
                       value={lng}
                       onChange={e => setLng(e.target.value)}
                       className="bg-transparent border-none outline-none text-sm font-semibold w-full px-1 text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-4">
                <button className="flex justify-between items-center gap-2 px-4 py-3 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex-1 w-full">
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-500" /> Leave Now</div>
                </button>
                <button className="flex justify-between items-center gap-2 px-4 py-3 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex-1 w-full">
                  <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-500" /> 1 Passenger</div>
                </button>
                <button 
                  onClick={requestRide} 
                  disabled={loading || !!activeRide}
                  className="bg-[#0D9488] hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-xl shadow-md w-full md:w-auto min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? "Waiting..." : "Find Autos"}
                </button>
              </div>
            </div>

            {/* Wallet Balance */}
            <div className="col-span-1 md:col-span-12 xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center xl:items-start text-center xl:text-left">
              <h3 className="text-sm font-bold text-slate-800 mb-4 xl:w-full">Wallet Balance</h3>
              <div className="flex items-center gap-3 mb-6 xl:w-full justify-center xl:justify-start">
                <div className="bg-[#ECFDF5] p-2.5 rounded-xl text-[#0D9488]">
                  <Wallet className="w-5 h-5"/>
                </div>
                <span className="text-2xl font-extrabold text-slate-800">₹250.00</span>
              </div>
              <button className="mt-auto w-full py-2.5 border-2 border-[#ECFDF5] bg-white text-[#0D9488] font-bold rounded-xl hover:bg-[#F0FDF4] transition-colors shadow-sm">
                Add Money
              </button>
            </div>

            {/* Quick Actions */}
            <div className="col-span-1 md:col-span-12 xl:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-6">Quick Actions</h3>
              <div className="flex justify-between items-start">
                {[
                  { icon: Bookmark, label: 'Saved Places' },
                  { icon: Ticket, label: 'Offers' },
                  { icon: Gift, label: 'Refer & Earn' },
                  { icon: Headset, label: 'Help' }
                ].map((action, i) => (
                  <div key={i} className="flex flex-col items-center gap-3 group cursor-pointer w-1/4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#F8FAFC] border-2 border-transparent group-hover:bg-[#F0FDF4] group-hover:text-[#0D9488] group-hover:border-[#0D9488] transition-all text-indigo-500 shadow-sm">
                      <action.icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 text-center leading-tight group-hover:text-[#0D9488] transition-colors">{action.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Middle Row Widgets */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

             {/* Available Rides */}
             <div className="col-span-1 xl:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
               <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                 <h3 className="font-bold text-slate-800 text-lg">Available Rides</h3>
                 <button className="text-[#0D9488] text-sm font-bold hover:underline">View all</button>
               </div>

               <div className="space-y-4 flex-1">
                 {availableDrivers.length > 0 ? availableDrivers.map((driver, i) => (
                   <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-slate-100 rounded-xl hover:shadow-md transition-all bg-white cursor-pointer group">
                     <div className="w-16 h-12 bg-slate-50 rounded-lg border shadow-sm flex items-center justify-center text-3xl shrink-0 group-hover:scale-105 transition-transform">
                       🛺
                     </div>
                     <div className="flex-1 w-full">
                       <div className="flex justify-between items-start mb-1">
                         <h4 className="font-extrabold text-slate-800">{driver.vehicle?.licensePlate || driver.licenseNumber || "N/A"}</h4>
                         <span className="text-xs font-bold px-2 py-0.5 rounded text-[#0D9488] bg-[#ECFDF5]">Available</span>
                       </div>
                       <div className="flex items-center gap-2 mb-2 w-full">
                         <span className="text-xs font-medium text-slate-600 truncate">{driver.user?.name || "Driver"}</span>
                         <MoveRight className="w-3 h-3 text-slate-300 shrink-0" />
                         <span className="text-xs font-medium text-slate-600 truncate">{driver.route?.name || "No assigned route"}</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                         <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                         <span>4.8 (new)</span>
                       </div>
                     </div>
                     <div className="flex flex-row sm:flex-col justify-between items-center sm:items-end gap-2 shrink-0 md:pl-4 md:border-l md:border-slate-50">
                       <div className="text-right flex flex-col justify-center h-full pt-1">
                         <span className="font-extrabold text-xl leading-none text-slate-800">₹--</span>
                         <p className="text-[10px] text-slate-400 font-semibold mt-1">per seat</p>
                       </div>
                       <button 
                          onClick={requestRide} 
                          disabled={loading || !!activeRide}
                          className="bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm transition-all self-end whitespace-nowrap disabled:opacity-50">
                         Book Now
                       </button>
                     </div>
                   </div>
                 )) : (
                   <p className="text-slate-500 text-sm font-semibold p-4 text-center">No available autos right now.</p>
                 )}
               </div>

               <div className="mt-4 pt-4 flex justify-between items-center bg-[#ECFDF5]/50 -mx-6 px-6 -mb-6 pb-6 rounded-b-2xl border-t border-slate-50">
                 <p className="text-sm font-semibold text-slate-600">Looking for more rides?</p>
                 <button className="px-5 py-2 border-2 border-[#0D9488] text-[#0D9488] text-xs font-bold rounded-lg bg-white hover:bg-[#F0FDF4] shadow-sm transition-colors">
                   View All Rides
                 </button>
               </div>
             </div>

             {/* Upcoming Booking & Refer */}
             <div className="col-span-1 xl:col-span-5 space-y-6 flex flex-col">
               
               {/* Upcoming Booking */}
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1 flex flex-col">
                 <div className="flex justify-between items-center mb-5">
                   <h3 className="font-bold text-slate-800 text-lg">My Active Booking</h3>
                 </div>
                 
                 {activeRide ? (
                   <>
                     <div className="flex justify-between items-center mb-6">
                       <div className="flex items-center gap-2 text-sm text-slate-700 font-bold">
                         <Calendar className="w-5 h-5 text-slate-400" />
                         Ride #{activeRide.id.toString().slice(-4).toUpperCase()}
                       </div>
                       <div className={`text-[10px] font-extrabold px-3 py-1 rounded-full tracking-wide ${activeRide.status === 'Requested' ? 'bg-[#FEF3C7] text-amber-700' : 'bg-[#ECFDF5] text-[#0D9488]'}`}>
                         {activeRide.status}
                       </div>
                     </div>

                     <div className="flex justify-between items-center mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-bold text-slate-800 text-sm">{activeRide.route?.name || "Pickup"}</span>
                          </div>
                          {driverDetails ? (
                            <>
                              <p className="text-xs font-medium text-slate-500 mb-1">Driver: {driverDetails.name}</p>
                              <p className="text-xs font-medium text-slate-500">{driverDetails.licenseNumber} • {driverDetails.phone}</p>
                            </>
                          ) : (
                            <p className="text-xs font-medium text-amber-500 animate-pulse">Waiting for driver assignment...</p>
                          )}
                        </div>
                     </div>

                     {/* Map Placeholder */}
                     <div className="w-full justify-center text-center bg-slate-100 rounded-xl mb-6 overflow-hidden relative border border-slate-200">
                        <div className="py-10 absolute inset-0 opacity-30 bg-[#E0F2FE]"></div>
                        <div className="py-10 text-slate-500 text-sm font-semibold truncate relative z-10 px-4">
                          Route ID: {activeRide.routeId || "Pending"}
                        </div>
                     </div>
                   </>
                 ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10">
                     <span className="text-4xl mb-4">📭</span>
                     <p className="text-sm font-semibold">No active bookings right now</p>
                   </div>
                 )}
               </div>

               {/* Refer & Earn Mini Banner */}
               <div className="bg-[#ECFDF5] border border-green-100 p-6 rounded-2xl flex items-center justify-between shrink-0 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/50 rounded-full translate-x-8 -translate-y-12 blur-2xl"></div>
                  <div className="absolute bottom-0 right-10 w-24 h-24 bg-green-300/30 rounded-full translate-y-8 blur-xl"></div>
                  
                  <div className="relative z-10 pr-4">
                    <h3 className="font-extrabold text-slate-800 text-lg mb-1">Refer & Earn</h3>
                    <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">Refer your friends and earn<br/>exciting rewards!</p>
                    <button className="bg-[#0D9488] hover:bg-teal-700 text-white text-xs py-2 px-5 rounded-lg font-bold shadow transition-colors">
                      Refer Now
                    </button>
                  </div>
                  <div className="relative z-10 w-24 h-24 flex items-center justify-center shrink-0">
                     <div className="absolute -top-3 right-0 bg-[#FEF3C7] p-2 rounded-lg shadow-sm border border-yellow-200 z-20">
                        <Gift className="w-5 h-5 text-yellow-600" />
                     </div>
                     <span className="text-6xl drop-shadow-md">🤝</span>
                  </div>
               </div>

             </div>

          </div>

          {/* Bottom Left: Recent Bookings */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-20">
             <div className="col-span-1 xl:col-span-12 2xl:col-span-12 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-slate-800 text-lg">Recent Bookings</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {history.length > 0 ? history.map((ride, idx) => (
                   <div key={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between border border-slate-100 cursor-pointer hover:border-green-200 hover:shadow-md bg-white p-4 rounded-xl transition-all gap-4">
                      <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
                        <div className="w-16 h-12 bg-slate-50 rounded-lg border shadow-sm flex items-center justify-center text-3xl shrink-0">🛺</div>
                        <div className="flex-1 w-full overflow-hidden">
                          <p className="text-sm font-extrabold text-slate-800 mb-1">{new Date(ride.createdAt).toLocaleString()}</p>
                          <div className="flex flex-wrap items-center gap-2 mb-1.5 w-full">
                             <span className="text-xs font-semibold text-slate-600 truncate">{ride.route?.name || `Requested Route ID: ${ride.routeId}`}</span>
                          </div>
                          {ride.driver && (
                            <p className="text-[10px] text-slate-500 font-medium tracking-wide">Driver: {ride.driver.user?.name || ride.driverId}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row md:flex-col justify-between w-full md:w-auto md:items-end gap-2 mt-4 md:mt-0 select-none">
                         <span className={`text-[10px] font-extrabold px-3 py-1 rounded tracking-wide border ${ride.status === 'Completed' ? 'bg-[#ECFDF5] text-[#0D9488] border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{ride.status}</span>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="font-black text-sm text-slate-400">ID: {ride.id.slice(-4).toUpperCase()}</span>
                         </div>
                      </div>
                   </div>
                 )) : (
                   <div className="col-span-full py-6 text-center text-slate-400 text-sm font-semibold">
                      You haven't completed any rides yet. 
                   </div>
                 )}
               </div>
             </div>
          </div>

        </div>
      </main>
    </div>
  );
}