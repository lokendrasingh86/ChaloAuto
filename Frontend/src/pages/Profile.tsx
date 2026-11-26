import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import {
  Map, User, Phone, Mail, Edit2, Save, X, LogOut, Loader, Star
} from 'lucide-react';

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<{ id?: string; name?: string; phone?: string; role?: string }>(
    () => JSON.parse(localStorage.getItem('user') || '{}'),
  );

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });

  const updateProfile = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.put(`/users/${user.id}`, { name: formData.name });
      const updatedUser = { ...user, name: res.data.name };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setIsEditing(false);
      toast({ title: "Success", description: "Profile updated successfully!" });
    } catch {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

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
            { label: 'My Bookings', path: '/bookings' },
            { label: 'Profile', path: '/profile', active: true },
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
        <div className="p-4 border-t">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 font-semibold rounded-lg hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen">
        <header className="bg-white px-8 py-4 border-b flex justify-between items-center">
          <h1 className="text-2xl font-bold">My Profile</h1>
          <button onClick={() => navigate('/passenger')} className="text-slate-500 hover:text-slate-700 text-sm font-semibold">Back to Dashboard</button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
          {/* Profile Header */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-6">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center font-bold text-2xl text-blue-700 shrink-0">
                {user?.name?.charAt(0) || 'P'}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-800">{user?.name || 'Passenger'}</h2>
                <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                  <User className="w-4 h-4" /> {user?.role || 'Passenger'}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span className="font-semibold text-slate-800">4.8</span>
                  <span className="text-sm text-slate-500">(45 reviews)</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setFormData({ name: user.name || '', phone: user.phone || '' });
                  setIsEditing(!isEditing);
                }}
                className="px-4 py-2 bg-[#0D9488] hover:bg-teal-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-all"
              >
                {isEditing ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          {/* Profile Details */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6 text-lg">Account Information</h3>

            {isEditing ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0D9488] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    disabled
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
                  />
                  <p className="mt-1 text-xs text-slate-400">Your phone number is your login and cannot be changed here.</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={updateProfile}
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-[#0D9488] hover:bg-teal-700 text-white font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                  <User className="w-5 h-5 text-[#0D9488]" />
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</p>
                    <p className="text-lg font-semibold text-slate-800">{user?.name || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                  <Phone className="w-5 h-5 text-[#0D9488]" />
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</p>
                    <p className="text-lg font-semibold text-slate-800">{user?.phone || 'N/A'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
                  <Mail className="w-5 h-5 text-[#0D9488]" />
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Type</p>
                    <p className="text-lg font-semibold text-slate-800">{user?.role || 'Passenger'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 p-8 rounded-2xl border border-red-200 mt-6">
            <h3 className="font-bold text-red-700 mb-3">Danger Zone</h3>
            <p className="text-sm text-red-600 mb-4">Once you logout, you'll need to login again to access your account.</p>
            <button
              onClick={logout}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
