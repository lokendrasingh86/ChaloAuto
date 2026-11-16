import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CarFront, Check, Clock3, LockKeyhole, MapPin, Phone, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import api from '@/lib/api';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('PASSENGER');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const requestOtp = async () => {
    if (!phone) return toast({ title: "Error", description: "Enter phone number", variant: "destructive" });
    try {
      await api.post('/auth/request-otp', { phone, role });
      setOtpSent(true);
      toast({ title: "OTP Sent", description: "If you used seed data, use 123456 as the OTP." });
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Failed to send OTP", variant: "destructive" });
    }
  };

  const verifyOtp = async () => {
    try {
      const res = await api.post('/auth/verify-otp', { phone, otp, role });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      toast({ title: "Success", description: "Logged in successfully!" });
      
      // The backend returns role as 'Passenger' or 'Driver'
      if (res.data.user.role === 'Passenger' || res.data.user.role === 'PASSENGER') {
        navigate('/passenger');
      } else {
        navigate('/driver');
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || "Invalid OTP", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-5 text-slate-800 sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_-30px_rgba(15,23,42,0.35)] lg:flex-row">
        <section className="relative overflow-hidden bg-[#0D9488] px-6 py-8 text-white sm:px-10 lg:flex lg:w-[48%] lg:flex-col lg:justify-between lg:px-14 lg:py-12">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full border-[38px] border-white/10" />
          <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full border-[30px] border-yellow-300/20" />
          <div className="relative z-10">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mb-12 inline-flex items-center gap-2 text-sm font-semibold text-teal-50 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </button>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#0D9488] shadow-lg">
                <CarFront className="h-7 w-7" />
              </span>
              <span className="text-2xl font-extrabold tracking-tight">ChaloAuto</span>
            </div>
            <div className="mt-14 max-w-md">
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-teal-100">
                <Sparkles className="h-4 w-4" /> Travel together · Save together
              </p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl">
                Your city ride is just a tap away.
              </h1>
              <p className="mt-5 max-w-sm text-base leading-7 text-teal-50">
                Join a smarter way to move around the city with fixed-route autos, fair fares, and real-time matching.
              </p>
            </div>
          </div>
          <div className="relative z-10 mt-12 grid max-w-md grid-cols-3 gap-3">
            {[
              { icon: MapPin, label: 'Route-based' },
              { icon: Users, label: 'Shared rides' },
              { icon: Clock3, label: 'Live updates' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                <Icon className="h-5 w-5 text-yellow-200" />
                <p className="mt-3 text-xs font-semibold text-teal-50">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-12 lg:px-16">
          <Card className="w-full max-w-md border-0 shadow-none">
            <CardContent className="p-0">
              <div className="mb-8">
                <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#0D9488]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#CCFBF1]">
                    {otpSent ? <Check className="h-4 w-4" /> : '1'}
                  </span>
                  <span>{otpSent ? 'Verify your number' : 'Secure sign in'}</span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  {otpSent ? 'Enter your OTP' : 'Welcome to ChaloAuto'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {otpSent
                    ? `We sent a one-time code to ${phone}.`
                    : 'Choose how you are travelling today and sign in with your phone number.'}
                </p>
              </div>

              {!otpSent && (
                <div className="mb-7">
                  <p className="mb-3 text-sm font-bold text-slate-700">I want to continue as</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'PASSENGER', label: 'Passenger', description: 'Find a shared ride', icon: UserRound },
                      { value: 'DRIVER', label: 'Driver', description: 'Manage your trips', icon: CarFront },
                    ].map(({ value, label, description, icon: Icon }) => {
                      const active = role === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRole(value)}
                          className={`relative rounded-2xl border p-4 text-left transition ${
                            active
                              ? 'border-[#0D9488] bg-[#F0FDFA] shadow-[0_8px_24px_-14px_rgba(13,148,136,0.8)]'
                              : 'border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50'
                          }`}
                        >
                          {active && <Check className="absolute right-3 top-3 h-4 w-4 text-[#0D9488]" />}
                          <Icon className={`h-5 w-5 ${active ? 'text-[#0D9488]' : 'text-slate-400'}`} />
                          <p className="mt-3 text-sm font-bold text-slate-800">{label}</p>
                          <p className="mt-1 text-xs text-slate-500">{description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-5">
                {!otpSent ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Phone number</span>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <Input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-12 text-sm shadow-none focus-visible:border-[#0D9488] focus-visible:ring-[#CCFBF1]"
                      />
                    </div>
                  </label>
                ) : (
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">6-digit verification code</span>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-12 text-lg tracking-[0.35em] shadow-none focus-visible:border-[#0D9488] focus-visible:ring-[#CCFBF1]"
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">Demo login code: <span className="font-bold text-slate-600">123456</span></p>
                  </label>
                )}

                <Button
                  className="h-12 w-full rounded-xl bg-[#0D9488] text-sm font-bold shadow-[0_10px_24px_-12px_rgba(13,148,136,0.9)] hover:bg-teal-700"
                  onClick={otpSent ? verifyOtp : requestOtp}
                >
                  {otpSent ? <>Verify and continue <ArrowRight className="h-4 w-4" /></> : <>Send OTP <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </div>

              {otpSent && (
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(''); }}
                  className="mt-5 w-full text-center text-sm font-semibold text-slate-500 transition hover:text-[#0D9488]"
                >
                  Use a different phone number
                </button>
              )}

              <div className="mt-9 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0D9488]" />
                <p>Your phone number is used only to securely sign you in. We never share your personal details.</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}