import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  type?: 'BUS' | 'USER' | 'STOP';
  speed?: number;
  status?: 'RUNNING' | 'HALTED' | 'STOPPED' | 'COMPLETED';
  nextStop?: string;
}

export interface GoogleMapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  routePath?: Array<{ lat: number; lng: number; name?: string }>;
  height?: number | string;
  followMarkerId?: string;
  showPassengerLocation?: boolean;
  autoFit?: boolean;
}

// ── Custom SVG Icons ─────────────────────────────────────────────────────────

function makeBusIcon(speed = 48, status: string = 'RUNNING', nextStop?: string, isFocused: boolean = true) {
  const isRunning = status === 'RUNNING';
  const badgeColor = isRunning ? '#00D488' : '#e11d48';

  if (!isFocused) {
    return L.divIcon({
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:22px;height:22px;">
          <div style="
            width:20px;
            height:20px;
            border-radius:50%;
            background:#0f172a;
            border:2px solid #00D488;
            box-shadow:0 2px 8px rgba(0,0,0,0.5);
            display:flex;
            align-items:center;
            justify-content:center;
            color:#00D488;
            font-size:11px;
          ">
            🚌
          </div>
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      className: 'gb-bus-marker-small',
    });
  }

  return L.divIcon({
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
        <!-- Floating Info Tag -->
        <div style="
          background:#0a101a;
          color:#ffffff;
          padding:4px 10px;
          border-radius:8px;
          font-family:Inter,sans-serif;
          font-size:11px;
          font-weight:800;
          white-space:nowrap;
          box-shadow:0 6px 16px rgba(0,0,0,0.6);
          border:1px solid #00D488;
          margin-bottom:4px;
          display:flex;
          align-items:center;
          gap:6px;
        ">
          <span style="width:6px;height:6px;border-radius:50%;background:${badgeColor};display:inline-block;box-shadow:0 0 6px ${badgeColor};"></span>
          <span style="color:#00D488;">${speed} km/h</span>
          ${nextStop ? `<span style="color:#cbd5e1;font-weight:600;">· ${nextStop}</span>` : ''}
        </div>

        <!-- Radar Pulse Circle -->
        <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">
          ${isRunning ? `
            <div style="
              position:absolute;
              inset:-8px;
              border-radius:50%;
              background:rgba(0, 212, 136, 0.28);
              animation:pulseBeacon 2s infinite ease-out;
            "></div>
          ` : ''}
          <div style="
            width:32px;
            height:32px;
            border-radius:50%;
            background:#00B87A;
            border:2.5px solid #ffffff;
            box-shadow:0 4px 14px rgba(0, 184, 122, 0.5);
            display:flex;
            align-items:center;
            justify-content:center;
            color:#ffffff;
            font-size:15px;
            z-index:2;
          ">
            🚌
          </div>
        </div>
      </div>
    `,
    iconSize: [140, 70],
    iconAnchor: [70, 62],
    className: 'gb-bus-marker-focused',
  });
}

function makeStopIcon(isTerminus = false) {
  const size = isTerminus ? 14 : 10;
  const color = isTerminus ? '#059669' : '#0f172a';

  return L.divIcon({
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        background:#ffffff;
        border:2.5px solid ${color};
        box-shadow:0 1px 4px rgba(0,0,0,0.25);
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: 'gb-stop-node',
  });
}

function makeUserIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;inset:-4px;border-radius:50%;background:rgba(37,99,235,0.3);animation:pulseBeacon 2s infinite;"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:#2563eb;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    className: 'gb-user-marker',
  });
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function GoogleMapView({
  center,
  zoom = 12,
  markers = [],
  routePath = [],
  height = 400,
  followMarkerId,
  showPassengerLocation = true,
  autoFit = true,
}: GoogleMapViewProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<L.Map | null>(null);
  const tileRef        = useRef<L.TileLayer | null>(null);
  const casingPolyRef  = useRef<L.Polyline | null>(null);
  const corePolyRef    = useRef<L.Polyline | null>(null);
  const busMarkersRef  = useRef<L.Marker[]>([]);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const userMarkerRef  = useRef<L.Marker | null>(null);

  const [isReady, setIsReady]     = useState(false);
  const [satellite, setSatellite] = useState(false);

  const OSM_URL  = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
  const SAT_URL  = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const SAT_ATTR = '&copy; Esri, Maxar, Earthstar Geographics';

  // 1. Initialise Leaflet map
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if ((el as any)._leaflet_id) {
      try {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch {
        // ignore
      }
      delete (el as any)._leaflet_id;
    }

    try {
      const map = L.map(el, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
      });

      tileRef.current = L.tileLayer(OSM_URL, {
        attribution: OSM_ATTR,
        maxZoom: 19,
        tileSize: 256,
      }).addTo(map);

      mapRef.current = map;
      setIsReady(true);

      const timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        if (el) {
          delete (el as any)._leaflet_id;
        }
      };
    } catch (err) {
      console.warn('Map initialization caught error:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Render Dual-Casing Transit Route + Stop Nodes
  useEffect(() => {
    if (!isReady || !mapRef.current) return;
    const map = mapRef.current;

    if (casingPolyRef.current) { casingPolyRef.current.remove(); casingPolyRef.current = null; }
    if (corePolyRef.current)   { corePolyRef.current.remove(); corePolyRef.current = null; }

    if (routePath.length > 1) {
      const latlngs = routePath.map((p) => [p.lat, p.lng] as [number, number]);

      // Outer casing line
      casingPolyRef.current = L.polyline(latlngs, {
        color: '#0f172a',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Inner transit line
      corePolyRef.current = L.polyline(latlngs, {
        color: '#059669',
        weight: 4,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      if (autoFit && latlngs.length > 0) {
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    routePath.forEach((stop, index) => {
      const isTerminus = index === 0 || index === routePath.length - 1;
      const m = L.marker([stop.lat, stop.lng], {
        icon: makeStopIcon(isTerminus),
        zIndexOffset: isTerminus ? 50 : 10,
      }).addTo(map);

      if (stop.name) {
        m.bindTooltip(
          `<div style="font-family:Inter,sans-serif;font-weight:700;font-size:11px;color:#0f172a;padding:2px 4px;">${stop.name}</div>`,
          {
            permanent: isTerminus,
            direction: 'top',
            offset: [0, -6],
            className: 'gb-clean-tooltip',
          }
        );
      }
      stopMarkersRef.current.push(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, JSON.stringify(routePath), autoFit]);

  // 3. Update Live Bus Markers
  useEffect(() => {
    if (!isReady || !mapRef.current) return;
    const map = mapRef.current;

    busMarkersRef.current.forEach((m) => m.remove());
    busMarkersRef.current = [];

    markers.forEach((marker) => {
      if (marker.type === 'BUS') {
        const isFocused = !followMarkerId || marker.id === followMarkerId;
        const icon = makeBusIcon(marker.speed, marker.status, marker.nextStop, isFocused);
        const m = L.marker([marker.lat, marker.lng], { icon, zIndexOffset: isFocused ? 1200 : 400 }).addTo(map);
        busMarkersRef.current.push(m);
      } else {
        const icon = makeUserIcon();
        const m = L.marker([marker.lat, marker.lng], { icon, zIndexOffset: 200 }).addTo(map);
        busMarkersRef.current.push(m);
      }
    });

    if (followMarkerId) {
      const target = markers.find((m) => m.id === followMarkerId);
      if (target) {
        map.panTo([target.lat, target.lng], { animate: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, JSON.stringify(markers), followMarkerId]);

  // 4. Passenger Geolocation
  useEffect(() => {
    if (!isReady || !mapRef.current || !showPassengerLocation) return;
    const map = mapRef.current;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mapRef.current) return;
        if (userMarkerRef.current) userMarkerRef.current.remove();
        userMarkerRef.current = L.marker(
          [pos.coords.latitude, pos.coords.longitude],
          { icon: makeUserIcon(), zIndexOffset: 500 }
        ).addTo(map).bindPopup('📍 Your Live Location');
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, showPassengerLocation]);

  // 5. Controls
  const handleToggleSatellite = () => {
    if (!mapRef.current) return;
    const next = !satellite;
    setSatellite(next);
    if (tileRef.current) tileRef.current.remove();

    tileRef.current = L.tileLayer(next ? SAT_URL : OSM_URL, {
      attribution: next ? SAT_ATTR : OSM_ATTR,
      maxZoom: 19,
      tileSize: 256,
    }).addTo(mapRef.current);
  };

  const handleRecenter = () => {
    if (!mapRef.current) return;
    const t = followMarkerId ? markers.find((m) => m.id === followMarkerId) : null;
    if (t) {
      mapRef.current.setView([t.lat, t.lng], 14, { animate: true });
    } else if (routePath.length > 0) {
      const bounds = L.latLngBounds(routePath.map((p) => [p.lat, p.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } else {
      mapRef.current.setView([center.lat, center.lng], zoom, { animate: true });
    }
  };

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--slate-200)',
        boxShadow: 'var(--shadow-sm)',
        backgroundColor: '#e2e8f0',
        isolation: 'isolate',
        zIndex: 1,
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading Skeleton */}
      {!isReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 24 }}>🧭</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>Loading Transit Map…</div>
        </div>
      )}

      {/* Floating Controls Top-Left */}
      {isReady && (
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, zIndex: 20 }}>
          <button
            type="button"
            onClick={handleToggleSatellite}
            style={{
              padding: '6px 12px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              color: '#0f172a',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{satellite ? '🗺️' : '🛰️'}</span>
            <span>{satellite ? 'Street Map' : 'Satellite'}</span>
          </button>

          <button
            type="button"
            onClick={handleRecenter}
            style={{
              padding: '6px 12px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              color: '#059669',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>🎯</span>
            <span>Recenter</span>
          </button>
        </div>
      )}

      {/* Floating Zoom Controls Top-Right */}
      {isReady && (
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 20 }}>
          <button
            type="button"
            onClick={handleZoomIn}
            style={{
              width: 32,
              height: 32,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              color: '#0f172a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            }}
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            style={{
              width: 32,
              height: 32,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 700,
              color: '#0f172a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            }}
          >
            −
          </button>
        </div>
      )}
    </div>
  );
}
