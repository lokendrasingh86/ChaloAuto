import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/geo';

// Leaflet is loaded from a CDN at runtime, so no extra npm dependency is needed.
const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error('Leaflet failed to load'));
    };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind?: 'pickup' | 'drop' | 'driver' | 'stop';
  label?: string;
  draggable?: boolean;
  onDragEnd?: (lat: number, lng: number) => void;
}

export interface MapLine {
  id: string;
  points: LatLng[];
  color?: string;
  dashed?: boolean;
  weight?: number;
}

interface Props {
  markers?: MapMarker[];
  lines?: MapLine[];
  onMapClick?: (lat: number, lng: number) => void;
  center?: LatLng;
  height?: number | string;
  fit?: boolean;
  className?: string;
}

const COLORS: Record<string, string> = {
  pickup: '#0D9488',
  drop: '#EF4444',
  stop: '#6366F1',
};

function iconHtml(m: MapMarker): string {
  if (m.kind === 'driver') {
    return `<div style="font-size:26px;line-height:26px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">🛺</div>`;
  }
  const color = COLORS[m.kind ?? 'stop'] ?? '#6366F1';
  const text = m.label ? `<span style="color:#fff;font:700 11px sans-serif">${m.label}</span>` : '';
  return `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">${text}</div>`;
}

export default function MapView({
  markers = [],
  lines = [],
  onMapClick,
  center = [28.6139, 77.209],
  height = 320,
  fit = true,
  className = '',
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const clickRef = useRef(onMapClick);
  const fittedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    clickRef.current = onMapClick;
  }, [onMapClick]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !el.current || mapRef.current) return;
        const map = L.map(el.current, { zoomControl: true }).setView(center, 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        map.on('click', (e: any) => clickRef.current?.(e.latlng.lat, e.latlng.lng));
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers and lines whenever they change.
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    const bounds: LatLng[] = [];

    for (const line of lines) {
      if (line.points.length < 2) continue;
      L.polyline(line.points, {
        color: line.color ?? '#0D9488',
        weight: line.weight ?? 4,
        opacity: 0.8,
        dashArray: line.dashed ? '6 8' : undefined,
      }).addTo(layer);
      bounds.push(...line.points);
    }

    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], {
        draggable: !!m.draggable,
        icon: L.divIcon({ html: iconHtml(m), className: '', iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).addTo(layer);
      if (m.draggable && m.onDragEnd) {
        marker.on('dragend', () => {
          const p = marker.getLatLng();
          m.onDragEnd?.(p.lat, p.lng);
        });
      }
      bounds.push([m.lat, m.lng]);
    }

    if (fit && bounds.length > 0 && !fittedRef.current) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      fittedRef.current = markers.length > 0 || lines.length > 0;
    }
  }, [markers, lines, fit, ready]);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500 ${className}`}
        style={{ height }}
      >
        Map could not be loaded (check your internet connection). You can still enter coordinates manually.
      </div>
    );
  }

  return <div ref={el} className={`z-0 overflow-hidden rounded-xl border border-slate-200 ${className}`} style={{ height }} />;
}
