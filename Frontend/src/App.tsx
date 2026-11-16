import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import PassengerDashboard from './pages/PassengerDashboard';
import DriverDashboard from './pages/DriverDashboard';
import FindRides from './pages/FindRides';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import HelpSupport from './pages/HelpSupport';
import Simulation from './pages/Simulation';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/simulation" element={<Simulation />} />
        <Route path="/passenger" element={<ProtectedRoute role="passenger"><PassengerDashboard /></ProtectedRoute>} />
        <Route path="/find-rides" element={<ProtectedRoute role="passenger"><FindRides /></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute role="passenger"><MyBookings /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><HelpSupport /></ProtectedRoute>} />
        <Route path="/driver" element={<ProtectedRoute role="driver"><DriverDashboard /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
