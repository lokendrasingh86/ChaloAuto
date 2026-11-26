import { inr } from '@/lib/geo';

export interface DriverOption {
  optionId: string;
  driver: { id: string; name: string; phone?: string; licenseNumber: string; vehicle: string | null; rating: number | null; reviewCount: number; previouslyRidden: boolean };
  pickupEtaSeconds: number;
  onboard: number;
  reserved: number;
  capacity: number;
  availableSeats: number;
  fare: number;
  shared: boolean;
  recommended: boolean;
  reason: string;
  expiresAt: string;
  estimateAt: string;
}

export default function DriverOptions({ options, busy, now, onSelect }: { options: DriverOption[]; busy: boolean; now: number; onSelect: (option: DriverOption) => void }) {
  return <div className="space-y-3">{options.slice(0, 4).map(option => <article key={option.optionId} className="rounded-xl border border-teal-200 bg-white p-4 shadow-sm">
    <div className="flex justify-between gap-2"><h3 className="font-bold">{option.driver.name}</h3>{option.recommended && <span className="text-xs font-bold text-teal-700">Recommended</span>}</div>
    <p className="text-xs text-slate-500">{option.driver.vehicle || 'Auto'} · {option.driver.licenseNumber}</p>
    {option.driver.previouslyRidden && <p className="mt-1 text-xs font-bold text-teal-700">Familiar driver</p>}
    <dl className="my-3 grid grid-cols-2 gap-2 text-sm">
      <div><dt className="text-slate-500">Estimated pickup</dt><dd>{Math.max(1, Math.ceil(option.pickupEtaSeconds / 60))} min</dd></div>
      <div><dt className="text-slate-500">Seats</dt><dd>{option.onboard} onboard · {option.reserved} reserved<br />{option.availableSeats} of {option.capacity} available</dd></div>
      <div><dt className="text-slate-500">Quoted fare</dt><dd className="font-bold">{inr(option.fare)}{option.shared ? ' · shared' : ''}</dd></div>
      <div><dt className="text-slate-500">Rating</dt><dd>{option.driver.rating == null ? 'New driver' : `${option.driver.rating.toFixed(1)} (${option.driver.reviewCount} reviews)`}</dd></div>
    </dl>
    <p className="mb-2 text-xs text-slate-500">{option.reason}</p>
    <p className="mb-3 text-xs text-slate-500">Road estimate, no live traffic · {new Date(option.estimateAt).toLocaleTimeString()}</p>
    {Date.parse(option.expiresAt) <= now && <p className="mb-2 text-xs text-amber-700">Quote expired. Refresh choices to select.</p>}
    <button disabled={busy || Date.parse(option.expiresAt) <= now} onClick={() => onSelect(option)} className="w-full rounded-lg bg-teal-600 p-2 font-bold text-white disabled:opacity-50">Choose {option.driver.name}</button>
  </article>)}</div>;
}
