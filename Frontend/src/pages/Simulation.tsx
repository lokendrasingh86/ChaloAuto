import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Map } from 'lucide-react';
import api from '@/lib/api';

type Row = Record<string, string | number>;
type SimData = { baseline: Row[]; demand: Row[] };

const ALGORITHMS = ['Nearest Driver', 'Greedy Pooling', 'System-Aware'] as const;
const COLORS: Record<string, string> = {
  'Nearest Driver': '#94A3B8',
  'Greedy Pooling': '#0D9488',
  'System-Aware': '#F59E0B',
};
const DESCRIPTIONS: Record<string, string> = {
  'Nearest Driver': 'Assigns each request to the closest available driver. No pooling, so it is the simple baseline.',
  'Greedy Pooling': 'Pools passengers into the same auto whenever a feasible match exists. Fewer vehicles, longer detours.',
  'System-Aware': 'Scores candidate assignments on passenger and system cost together for a balanced result.',
};

const METRICS = [
  { key: 'service_rate', label: 'Service rate', unit: '%', pct: true, higherBetter: true, file: 'service_rate' },
  { key: 'average_pickup_wait', label: 'Avg pickup wait', unit: 'min', pct: false, higherBetter: false, file: 'average_pickup_wait' },
  { key: 'average_detour', label: 'Avg detour', unit: '', pct: false, higherBetter: false, file: 'average_detour' },
  { key: 'pooling_rate', label: 'Pooling rate', unit: '%', pct: true, higherBetter: true, file: 'pooling_rate' },
  { key: 'vehicles_used', label: 'Vehicles used', unit: '', pct: false, higherBetter: false, file: 'vehicles_used' },
  { key: 'total_distance', label: 'Total distance', unit: '', pct: false, higherBetter: false, file: 'total_distance' },
] as const;

const SCENARIOS = ['Baseline', 'Low', 'Medium', 'High', 'Very High'];

const num = (v: string | number | undefined) => (typeof v === 'number' ? v : Number(v ?? 0));
const plotUrl = (name: string) => `/simulation/plots/${name}.png`;

export default function Simulation() {
  const [data, setData] = useState<SimData | null>(null);
  const [error, setError] = useState(false);
  const [scenario, setScenario] = useState('Baseline');
  const [metricKey, setMetricKey] = useState<string>('service_rate');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await api.get('/simulation/summary');
        if (alive) setData(res.data);
      } catch {
        try {
          const res = await fetch('/simulation/summary.json');
          if (!res.ok) throw new Error('missing');
          const json = (await res.json()) as SimData;
          if (alive) setData(json);
        } catch {
          if (alive) setError(true);
        }
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  const rows = useMemo(() => {
    if (!data) return [];
    return scenario === 'Baseline' ? data.baseline : data.demand.filter((r) => r.demand_level === scenario);
  }, [data, scenario]);

  const intervals = useMemo(
    () => Array.from(new Set(rows.map((r) => num(r.interval)))).sort((a, b) => a - b),
    [rows],
  );

  const valueOf = (algo: string, interval: number, key: string) => {
    const r = rows.find((x) => x.algorithm === algo && num(x.interval) === interval);
    return r ? num(r[key]) : 0;
  };
  const fmt = (v: number, m: (typeof METRICS)[number]) => (m.pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(1));

  const maxValue = Math.max(0.0001, ...rows.map((r) => num(r[metric.key])));

  const scenarioPlot =
    scenario === 'Baseline'
      ? plotUrl(metric.key === 'average_pickup_wait' ? 'average_wait' : metric.file)
      : plotUrl(`${scenario.toLowerCase().replace(' ', '_')}_${metric.file}`);
  const comparePlot = plotUrl(`demand_comparison_${metric.file}`);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4 md:px-12">
        <Link to="/" className="flex items-center gap-2 text-2xl font-extrabold text-[#0D9488]">
          <span className="rounded-lg bg-[#E0F2FE] p-1.5"><Map className="h-6 w-6" /></span>
          ChaloAuto
        </Link>
        <Link
          to={localStorage.getItem('token') ? '/passenger' : '/login'}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          {localStorage.getItem('token') ? 'Dashboard' : 'Login'}
        </Link>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div>
          <h1 className="text-3xl font-extrabold">Pooling Simulation</h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Before going live, ChaloAuto's ride-matching ideas were compared in a Python simulator across demand levels
            and matching intervals. Explore the results below.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {ALGORITHMS.map((a) => (
            <div key={a} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: COLORS[a] }} />
                <h3 className="font-bold">{a}</h3>
              </div>
              <p className="text-sm text-slate-500">{DESCRIPTIONS[a]}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  scenario === s ? 'bg-[#0D9488] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === 'Baseline' ? 'Baseline' : `${s} demand`}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetricKey(m.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  metricKey === m.key
                    ? 'border-[#0D9488] bg-[#ECFDF5] text-[#0D9488]'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-red-500">Could not load simulation results.</p>}
          {!data && !error && <p className="animate-pulse text-sm text-slate-400">Loading results...</p>}

          {data && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">
                  {metric.label}
                  {metric.unit && <span className="ml-1 text-sm font-medium text-slate-400">({metric.unit})</span>}
                </h2>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {intervals.map((interval) => (
                  <div key={interval}>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                      Interval {interval}
                    </p>
                    <div className="flex h-40 items-end gap-3">
                      {ALGORITHMS.map((a) => {
                        const v = valueOf(a, interval, metric.key);
                        return (
                          <div key={a} className="flex flex-1 flex-col items-center justify-end">
                            <span className="mb-1 text-[11px] font-semibold text-slate-600">{fmt(v, metric)}</span>
                            <div
                              className="w-full rounded-t-md"
                              style={{ height: `${Math.max(2, (v / maxValue) * 100)}%`, background: COLORS[a] }}
                              title={`${a}: ${fmt(v, metric)}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-500">
                {ALGORITHMS.map((a) => (
                  <span key={a} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[a] }} />
                    {a}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {data && (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Algorithm</th>
                  <th className="px-4 py-3">Interval</th>
                  {METRICS.map((m) => (
                    <th key={m.key} className="px-4 py-3">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{String(r.algorithm)}</td>
                    <td className="px-4 py-3">{num(r.interval)}</td>
                    {METRICS.map((m) => (
                      <td key={m.key} className="px-4 py-3">{fmt(num(r[m.key]), m)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {[scenarioPlot, comparePlot].map((src) => (
            <img
              key={src}
              src={src}
              alt={`${metric.label} plot`}
              className="w-full rounded-2xl border border-slate-100 bg-white p-2 shadow-sm"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
