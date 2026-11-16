import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
      <p className="text-6xl">🛺</p>
      <h1 className="mt-4 text-3xl font-extrabold text-slate-800">Page not found</h1>
      <p className="mt-2 text-slate-500">This auto took a wrong turn.</p>
      <Link to="/" className="mt-6 rounded-xl bg-[#0D9488] px-6 py-3 font-bold text-white hover:bg-teal-700">
        Back to home
      </Link>
    </div>
  );
}
