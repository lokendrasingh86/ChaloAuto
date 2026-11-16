import { Link } from 'react-router-dom';
import { Map, MapPin, Clock, Star, MoveRight, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: MapPin,
    title: 'Fixed-route shared autos',
    text: 'Drivers run set routes across the city. Passengers are matched to the nearest point on a route.',
  },
  {
    icon: Clock,
    title: 'Real-time updates',
    text: 'Requests, acceptances and completions reach passengers and drivers instantly over Socket.io.',
  },
  {
    icon: BarChart3,
    title: 'Simulation-backed matching',
    text: 'Pooling strategies were tested in a simulator: Nearest Driver, Greedy Pooling and System-Aware.',
  },
];

const steps = [
  'Log in with your phone number and OTP',
  'Enter your pickup point and request an auto',
  'A driver on that route accepts and picks you up',
];

export default function Landing() {
  const loggedIn = !!localStorage.getItem('token');
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 md:px-12">
        <span className="flex items-center gap-2 text-2xl font-extrabold text-[#0D9488]">
          <span className="rounded-lg bg-[#E0F2FE] p-1.5"><Map className="h-6 w-6" /></span>
          ChaloAuto
        </span>
        <nav className="flex items-center gap-3 text-sm font-semibold">
          <Link to="/simulation" className="px-3 py-2 text-slate-600 hover:text-slate-900">Simulation</Link>
          <Link to={loggedIn ? '/passenger' : '/login'} className="rounded-xl bg-[#0D9488] px-5 py-2 text-white hover:bg-teal-700">
            {loggedIn ? 'Dashboard' : 'Login'}
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-24">
        <div>
          <span className="inline-block rounded-full bg-[#ECFDF5] px-4 py-1 text-xs font-bold uppercase tracking-wider text-[#0D9488]">
            Travel together · Save together
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-5xl">
            Shared auto rides, <span className="text-[#0D9488]">made smart.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-slate-500">
            Book a seat in an auto already heading your way. Cheaper rides, fewer vehicles on the road.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-6 py-3 font-bold text-white shadow-md hover:bg-teal-700">
              Get started <MoveRight className="h-4 w-4" />
            </Link>
            <Link to="/simulation" className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 hover:bg-slate-50">
              See the simulation
            </Link>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="flex h-64 w-64 items-center justify-center rounded-3xl border-4 border-yellow-200 bg-[#FEF3C7] text-8xl shadow-lg md:h-80 md:w-80 md:text-9xl">
            🛺
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#0D9488]">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-white px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-2xl font-extrabold">How it works</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s} className="text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#0D9488] font-bold text-white">{i + 1}</div>
                <p className="text-sm font-medium text-slate-600">{s}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 flex items-center justify-center gap-1 text-sm text-slate-400">
            <Star className="h-4 w-4" /> ChaloAuto · Built with React, Express, Prisma &amp; Socket.io
          </p>
        </div>
      </section>
    </div>
  );
}
