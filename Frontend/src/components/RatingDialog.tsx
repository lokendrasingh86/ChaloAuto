import { useState } from 'react';
import { Loader, Star } from 'lucide-react';
import { inr } from '@/lib/geo';

interface Props {
  fare?: number | null;
  distanceKm?: number | null;
  driverName?: string | null;
  submitting?: boolean;
  onSubmit: (rating: number, comment: string) => void;
  onSkip: () => void;
}

export default function RatingDialog({ fare, distanceKm, driverName, submitting, onSubmit, onSkip }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-2 text-xl font-extrabold text-slate-800">You have arrived</h2>
          <p className="mt-1 text-sm text-slate-500">
            {distanceKm != null ? `${distanceKm.toFixed(1)} km · ` : ''}
            <span className="font-bold text-[#0D9488]">{inr(fare)}</span> to pay the driver
          </p>
        </div>

        <p className="mb-2 text-center text-sm font-semibold text-slate-600">
          How was your ride{driverName ? ` with ${driverName}` : ''}?
        </p>
        <div className="mb-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star`}>
              <Star className={`h-8 w-8 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Add a comment (optional)"
          className="mb-4 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-[#0D9488] focus:outline-none"
        />
        <div className="flex gap-3">
          <button onClick={onSkip} className="flex-1 rounded-lg border border-slate-200 py-2.5 font-semibold text-slate-600 hover:bg-slate-50">
            Skip
          </button>
          <button
            onClick={() => onSubmit(rating, comment)}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0D9488] py-2.5 font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting && <Loader className="h-4 w-4 animate-spin" />} Submit
          </button>
        </div>
      </div>
    </div>
  );
}
