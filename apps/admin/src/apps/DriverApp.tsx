import { useState, useEffect, useCallback } from 'react';
import { useAdminAuthStore } from '../stores/auth.store.js';
import { apiClient } from '../services/api.client.js';
import { GoogleMapView, MapMarker } from '../components/maps/GoogleMapView.js';
import { TopHeader } from '../components/layout/TopHeader.js';
import { useThemeStore } from '../stores/theme.store.js';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal.js';

type DriverNavTab = 'HOME' | 'MAP' | 'STOPS' | 'HISTORY' | 'PROFILE';

export interface CorridorStop {
  id: string;
  name: string;
  nameOd: string;
  km: number;
  time: string;
  isPassed: boolean;
  isCurrent: boolean;
  lat?: number;
  lng?: number;
}

export interface DriverBusDetails {
  name: string;
  reg: string;
  route: string;
  routeCode: string;
}

interface CompletedTrip {
  id: string;
  date: string;
  route: string;
  busReg: string;
  duration: string;
  passengers: number;
  status: 'COMPLETED';
}

export function DriverApp() {
  const { user, logout } = useAdminAuthStore();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<DriverNavTab>('HOME');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Trip Lifecycle State
  const [tripStatus, setTripStatus] = useState<'SCHEDULED' | 'IN_TRANSIT' | 'COMPLETED'>('SCHEDULED');
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [gpsState, setGpsState] = useState<'STANDBY' | 'ACQUIRING' | 'ACTIVE' | 'DENIED' | 'UNAVAILABLE'>('STANDBY');
  const [isSosActive, setIsSosActive] = useState(false);

  // Live Telemetry (Real values only)
  const [speed, setSpeed] = useState(0);
  const [passengerCount, setPassengerCount] = useState(0);
  const [totalSeats, setTotalSeats] = useState(40);
  const [nextStop, setNextStop] = useState('');
  const [etaMins, setEtaMins] = useState<number | null>(null);
  const [tripMinutes, setTripMinutes] = useState(0);
  const [activeTripId, setActiveTripId] = useState('');

  // Assigned Vehicle & Route: null when no active duty assigned
  const [busDetails, setBusDetails] = useState<DriverBusDetails | null>(null);

  // Coordinates: null until real device GPS fix is acquired
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [stopsList, setStopsList] = useState<CorridorStop[]>([]);

  // Completed Trips History from API
  const [tripHistory, setTripHistory] = useState<CompletedTrip[]>([]);

  // 1. Fetch Real Driver Duty from API
  const loadDriverDuty = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/driver/duty').catch(() => null);
      const dutyData = res?.data?.data;
      const activeTrip = dutyData?.activeTrip || dutyData?.duty;
      if (activeTrip) {
        const tripId = activeTrip.id || activeTrip.tripId;
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (tripId && UUID_REGEX.test(tripId)) {
          setActiveTripId(tripId);
        }
        if (activeTrip.status === 'RUNNING' || activeTrip.status === 'IN_TRANSIT') {
          setTripStatus('IN_TRANSIT');
          setIsGpsActive(true);
        } else if (activeTrip.status === 'SCHEDULED' || activeTrip.status === 'BOARDING') {
          setTripStatus('SCHEDULED');
        } else if (activeTrip.status === 'COMPLETED') {
          setTripStatus('COMPLETED');
        }
        if (activeTrip.totalSeats !== undefined) {
          setTotalSeats(activeTrip.totalSeats);
        }
        if (activeTrip.availableSeats !== undefined && activeTrip.totalSeats !== undefined) {
          setPassengerCount(activeTrip.totalSeats - activeTrip.availableSeats);
        }
        const regNumber = activeTrip.busRegistrationNumber || activeTrip.busRegistration || activeTrip.bus?.registrationNumber || '';
        const modelName = activeTrip.busModel || activeTrip.bus?.model || 'Assigned Transit Bus';
        const origin = activeTrip.origin || activeTrip.route?.origin || '';
        const destination = activeTrip.destination || activeTrip.route?.destination || '';
        const routeCode = activeTrip.routeCode || activeTrip.route?.routeCode || '';

        if (regNumber) {
          setBusDetails({
            name: modelName,
            reg: regNumber,
            route: origin && destination ? `${origin} ➔ ${destination}` : 'Assigned Route',
            routeCode: routeCode || 'Commercial Route',
          });
        }
        if (activeTrip.stops && Array.isArray(activeTrip.stops) && activeTrip.stops.length > 0) {
          const mapped: CorridorStop[] = activeTrip.stops.map((s: any, idx: number) => ({
            id: s.stopId || s.id || `s-${idx}`,
            name: s.stopName || s.name || `Stop ${idx + 1}`,
            nameOd: s.stopNameOd || s.nameOd || s.stopName || s.name || `ଷ୍ଟପ୍ ${idx + 1}`,
            km: s.distanceFromStartKm ?? s.distanceKm ?? idx * 1.5,
            time: s.estimatedMinutesFromStart !== undefined
              ? `+${s.estimatedMinutesFromStart}m`
              : (s.time || `${8 + Math.floor(idx / 2)}:${(idx % 2) * 30 || '00'} AM`),
            isPassed: s.isPassed || false,
            isCurrent: s.isCurrent || idx === 0,
            lat: s.latitude || s.lat,
            lng: s.longitude || s.lng,
          }));
          setStopsList(mapped);
          const current = mapped.find((s) => s.isCurrent) || mapped[0];
          if (current) setNextStop(current.name);
        } else {
          setStopsList([]);
          setNextStop('');
        }
      } else {
        // Honest empty state when no active trip is assigned
        setActiveTripId('');
        setBusDetails(null);
        setStopsList([]);
        setNextStop('');
        setTripStatus('SCHEDULED');
        setIsGpsActive(false);
        setSpeed(0);
      }

      // Load completed history
      const histRes = await apiClient.get('/api/v1/driver/history').catch(() => null);
      if (histRes?.data?.data?.trips && Array.isArray(histRes.data.data.trips)) {
        const historyData: CompletedTrip[] = histRes.data.data.trips.map((t: any) => ({
          id: t.id || `TRIP-${t.id?.slice(0, 4)}`,
          date: t.actualDeparture ? new Date(t.actualDeparture).toLocaleDateString() : 'Recent',
          route: `${t.origin || ''} ➔ ${t.destination || ''}`.trim() || t.routeCode || 'Route Trip',
          busReg: t.busRegistrationNumber || t.bus?.registrationNumber || 'N/A',
          duration: t.actualDeparture && t.actualArrival
            ? `${Math.round((new Date(t.actualArrival).getTime() - new Date(t.actualDeparture).getTime()) / 60000)}m`
            : 'Completed',
          passengers: t.passengerCount || 0,
          status: 'COMPLETED' as const,
        }));
        setTripHistory(historyData);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadDriverDuty();
  }, [loadDriverDuty]);

  // Acquire real device location on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          if (err.code === 1) {
            setGpsState('DENIED');
          } else {
            setGpsState('UNAVAILABLE');
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }
  }, []);

  // Dynamically update current / passed stops and next stop ETA based on real GPS
  useEffect(() => {
    if (!coords || stopsList.length === 0) return;

    let currentIdx = -1;
    for (let i = 0; i < stopsList.length; i++) {
      const s = stopsList[i];
      if (s.lat) {
        if (coords.lat < s.lat + 0.003) {
          currentIdx = i;
          break;
        }
      }
    }
    if (currentIdx === -1) currentIdx = stopsList.length - 1;

    const upcoming = stopsList[currentIdx];
    if (upcoming) {
      setNextStop(upcoming.name);
      if (upcoming.lat && upcoming.lng) {
        const R = 6371;
        const dLat = ((upcoming.lat - coords.lat) * Math.PI) / 180;
        const dLon = ((upcoming.lng - coords.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((coords.lat * Math.PI) / 180) * Math.cos((upcoming.lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const effectiveSpeed = Math.max(speed, 25);
        setEtaMins(Math.max(1, Math.round((distKm / effectiveSpeed) * 60)));
      }
    }

    setStopsList((prev) =>
      prev.map((s, idx) => ({
        ...s,
        isPassed: idx < currentIdx,
        isCurrent: idx === currentIdx,
      }))
    );
  }, [coords, speed]);

  // 2. Real Hardware GPS Stream to Backend
  useEffect(() => {
    let watchId: number | null = null;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (tripStatus === 'IN_TRANSIT' && isGpsActive) {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            const rawSpeed = position.coords.speed;
            const liveSpeed =
              typeof rawSpeed === 'number' && !isNaN(rawSpeed) && rawSpeed >= 0
                ? Math.min(200, Math.max(0, Math.round(rawSpeed * 3.6)))
                : null;

            const rawHeading = position.coords.heading;
            const liveHeading =
              typeof rawHeading === 'number' && !isNaN(rawHeading) && rawHeading >= 0 && rawHeading <= 360
                ? Math.round(rawHeading)
                : null;

            const rawAcc = position.coords.accuracy;
            const liveAccuracy =
              typeof rawAcc === 'number' && !isNaN(rawAcc) && rawAcc >= 0
                ? Math.round(rawAcc)
                : undefined;

            setCoords({ lat, lng });
            setSpeed(liveSpeed ?? 0);
            setGpsState('ACTIVE');

            // Prevent tracking pings when required trip or GPS data is unavailable
            const isValidLat = typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
            const isValidLng = typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
            if (!activeTripId || !UUID_REGEX.test(activeTripId) || !isValidLat || !isValidLng) {
              return;
            }

            apiClient
              .post('/api/v1/tracking/ping', {
                tripId: activeTripId,
                latitude: lat,
                longitude: lng,
                ...(liveSpeed !== null ? { speed: liveSpeed } : {}),
                ...(liveHeading !== null ? { heading: liveHeading } : {}),
                ...(liveAccuracy !== undefined ? { accuracy: liveAccuracy } : {}),
                timestamp: Date.now(),
              })
              .catch((err: any) => {
                // Halt repeated invalid requests on 4xx client errors (e.g., 400 validation, 403 forbidden, 404 not found)
                const statusCode = err?.response?.status;
                if (statusCode && statusCode >= 400 && statusCode < 500) {
                  console.warn(`[GPS Ping] Halted invalid requests due to API error ${statusCode}`);
                  setIsGpsActive(false);
                  setGpsState('STANDBY');
                }
              });
          },
          (err) => {
            if (err.code === 1) {
              setGpsState('DENIED');
            } else {
              setGpsState('UNAVAILABLE');
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
        );
      } else {
        setGpsState('UNAVAILABLE');
      }
    } else {
      setGpsState('STANDBY');
    }

    return () => {
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [tripStatus, isGpsActive, activeTripId]);

  // Trip Elapsed Timer
  useEffect(() => {
    if (tripStatus !== 'IN_TRANSIT') return;
    const interval = setInterval(() => {
      setTripMinutes((m) => m + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, [tripStatus]);

  // 3. START TRIP Action (Activates Real GPS stream & Sets Bus LIVE)
  const handleStartTrip = async () => {
    setTripStatus('IN_TRANSIT');
    setIsGpsActive(true);
    setGpsState('ACQUIRING');
    setTripMinutes(0);
    setSpeed(0); // real GPS speed will update on first position fix

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (activeTripId && UUID_REGEX.test(activeTripId)) {
      try {
        await apiClient.post(`/api/v1/driver/duty/${activeTripId}/start`).catch(() => {
          return apiClient.post('/api/v1/driver/trip/start', {
            tripId: activeTripId,
            busReg: busDetails?.reg || '',
            startTime: new Date().toISOString(),
          }).catch(() => {});
        });
      } catch {}
    }
  };

  // 4. END TRIP Action (Stops GPS & Completes Duty)
  const handleEndTrip = async () => {
    setTripStatus('COMPLETED');
    setIsGpsActive(false);
    setGpsState('STANDBY');
    setSpeed(0);

    const completed: CompletedTrip = {
      id: `TRIP-${Math.floor(1000 + Math.random() * 9000)}`,
      date: 'Today',
      route: busDetails?.route || 'Route',
      busReg: busDetails?.reg || '',
      duration: `${Math.floor(tripMinutes / 60)}h ${tripMinutes % 60}m`,
      passengers: passengerCount,
      status: 'COMPLETED',
    };
    setTripHistory([completed, ...tripHistory]);

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (activeTripId && UUID_REGEX.test(activeTripId)) {
      try {
        await apiClient.post(`/api/v1/driver/duty/${activeTripId}/end`).catch(() => {
          return apiClient.post('/api/v1/driver/trip/end', {
            tripId: activeTripId,
            endTime: new Date().toISOString(),
          }).catch(() => {});
        });
      } catch {}
    }
  };

  // 5. SOS Trigger
  const handleToggleSos = () => {
    const nextState = !isSosActive;
    setIsSosActive(nextState);

    if (nextState && coords) {
      apiClient.post('/api/v1/driver/sos', {
        tripId: activeTripId || undefined,
        busReg: busDetails?.reg || 'UNASSIGNED',
        latitude: coords.lat,
        longitude: coords.lng,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }
  };

  const mapMarkers: MapMarker[] = [
    ...(coords
      ? [
          {
            id: 'driver-bus',
            lat: coords.lat,
            lng: coords.lng,
            title: busDetails?.name || 'Bus',
            subtitle: `${busDetails?.reg || ''} · Speed ${speed} km/h`,
            type: 'BUS' as const,
            speed,
            status: (tripStatus === 'IN_TRANSIT' ? 'RUNNING' : 'STOPPED') as any,
            nextStop: nextStop || undefined,
          },
        ]
      : []),
    ...stopsList
      .filter((s) => s.lat && s.lng)
      .map((s, idx) => ({
        id: `stop-${s.id}`,
        lat: s.lat!,
        lng: s.lng!,
        title: `${idx + 1}. ${s.name}`,
        subtitle: `${s.km} km · Scheduled: ${s.time}`,
        type: 'STOP' as const,
        status: (s.isCurrent ? 'HALTED' : 'STOPPED') as any,
      })),
  ];

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#050a0f', color: '#ffffff', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>


      {/* ── DRIVER 5-ITEM LEFT SIDEBAR ── */}
      <aside
        style={{
          width: 260,
          backgroundColor: '#04080e',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 1000,
          padding: '24px 16px 20px 16px',
          boxSizing: 'border-box',
          transition: 'transform 0.2s ease',
        }}
        className={`passenger-sidebar ${isMobileNavOpen ? 'mobile-open' : ''}`}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #00D488 0%, #00875A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 16px rgba(0,212,136,0.3)' }}>
              🛞
            </div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.5, color: '#ffffff' }}>
                RURAL<span style={{ color: '#00D488' }}>BUS</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00D488', letterSpacing: 0.5 }}>
                Driver Duty HUD
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileNavOpen(false)}
            className="sidebar-close-btn"
            aria-label="Close navigation menu"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* The 5 Main Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {[
            { id: 'HOME',    icon: '🏠', label: 'My Trip / HUD' },
            { id: 'MAP',     icon: '🗺️', label: 'Live Trip Map' },
            { id: 'STOPS',   icon: '📍', label: 'Route & Stops' },
            { id: 'HISTORY', icon: '📜', label: 'Trip History' },
            { id: 'PROFILE', icon: '👤', label: 'Profile' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id as DriverNavTab);
                  setIsMobileNavOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 16px',
                  borderRadius: 12,
                  backgroundColor: isActive ? 'rgba(0, 212, 136, 0.12)' : 'transparent',
                  border: isActive ? '1px solid #00D488' : '1px solid transparent',
                  color: isActive ? '#00D488' : '#cbd5e1',
                  fontSize: '0.96rem',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Driver Profile Card & Sign Out */}
        <div style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#00593b', color: '#00D488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, border: '1px solid rgba(0, 212, 136, 0.3)' }}>
              {user?.fullName ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'DR'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.fullName || 'Driver'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Driver · {busDetails?.reg || 'No Trip Assigned'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: 'rgba(225, 29, 72, 0.12)',
              border: '1px solid rgba(225, 29, 72, 0.25)',
              borderRadius: 10,
              color: '#fca5a5',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            <span>🚪</span>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isMobileNavOpen && (
        <div
          onClick={() => setIsMobileNavOpen(false)}
          className="sidebar-backdrop"
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 14999 }}
        />
      )}

      {/* ── FLEXIBLE WORKSPACE WITH FIXED UPPER HEADER ── */}
      <div className="main-wrapper">
        <TopHeader
          icon="🛞"
          roleBadge="DRIVER"
          roleBadgeColor="#00D488"
          roleBadgeBg="rgba(0, 212, 136, 0.15)"
          portalTitle="Driver Duty HUD"
          portalSubtitle={busDetails ? `Vehicle: ${busDetails.reg} · ${busDetails.route}` : 'No Active Trip Assigned'}
          activeViewTitle={
            activeTab === 'HOME'
              ? 'Duty HUD & Telemetry'
              : activeTab === 'MAP'
              ? 'Live Trip Radar'
              : activeTab === 'STOPS'
              ? 'Route Stoppages'
              : activeTab === 'HISTORY'
              ? 'Trip History'
              : 'Driver Profile'
          }
          isMobileNavOpen={isMobileNavOpen}
          onToggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
        />

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            padding: '16px clamp(14px, 2.5vw, 32px) 32px',
            boxSizing: 'border-box',
          }}
          className="passenger-main"
        >
        {/* Persistent Sticky SOS Trigger Banner */}
        <div
          style={{
            background: isSosActive ? 'rgba(225, 29, 72, 0.25)' : 'rgba(10, 16, 26, 0.85)',
            border: isSosActive ? '2px solid #e11d48' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            boxShadow: isSosActive ? '0 0 25px rgba(225, 29, 72, 0.4)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: isSosActive ? '#e11d48' : '#00D488', boxShadow: isSosActive ? '0 0 10px #e11d48' : '0 0 8px #00D488' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: isSosActive ? '#fca5a5' : '#ffffff' }}>
                {isSosActive ? '🚨 SOS EMERGENCY BROADCASTING TO CONTROL ROOM' : 'Emergency Assistance & Highway SOS'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {isSosActive ? 'Live GPS coords transmitted to nearest highway control' : 'Press in case of breakdown, medical crisis or accident'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleSos}
            style={{
              padding: '8px 18px',
              backgroundColor: isSosActive ? '#e11d48' : 'rgba(225, 29, 72, 0.18)',
              border: '1px solid #e11d48',
              borderRadius: 10,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 900,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🚨</span>
            <span>{isSosActive ? 'CANCEL SOS' : 'EMERGENCY SOS'}</span>
          </button>
        </div>

        {/* ══ 1. HOME / MY TRIP SCREEN (SIMPLIFIED DRIVER HUD) ══ */}
        {activeTab === 'HOME' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
            
            {/* Assigned Bus & Corridor Banner */}
            {busDetails ? (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(10, 24, 20, 0.95) 0%, rgba(10, 16, 26, 0.95) 100%)',
                  border: '1.5px solid #00D488',
                  borderRadius: 20,
                  padding: '22px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 16,
                  boxShadow: '0 15px 35px rgba(0, 212, 136, 0.15)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>{busDetails.reg}</span>
                    <span style={{ background: '#00D488', color: '#000', fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 9999 }}>
                      ASSIGNED VEHICLE
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: '#cbd5e1', marginTop: 4, fontWeight: 600 }}>
                    {busDetails.name} · {busDetails.routeCode}
                  </div>
                  <div style={{ fontSize: 15, color: '#00D488', marginTop: 6, fontWeight: 800 }}>
                    Corridor: {busDetails.route}
                  </div>
                </div>

                {/* Real-time Status Pills */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: tripStatus === 'IN_TRANSIT' ? 'rgba(0, 212, 136, 0.15)' : 'rgba(245, 158, 11, 0.15)', border: `1px solid ${tripStatus === 'IN_TRANSIT' ? '#00D488' : '#f59e0b'}`, padding: '6px 12px', borderRadius: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: tripStatus === 'IN_TRANSIT' ? '#00D488' : '#f59e0b' }} />
                    <strong style={{ color: tripStatus === 'IN_TRANSIT' ? '#00D488' : '#f59e0b' }}>
                      {tripStatus === 'IN_TRANSIT' ? 'IN TRANSIT (LIVE)' : tripStatus === 'SCHEDULED' ? 'READY TO START' : 'COMPLETED'}
                    </strong>
                  </div>

                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    GPS: <strong style={{
                      color: gpsState === 'ACTIVE' ? '#00D488'
                        : gpsState === 'ACQUIRING' ? '#38bdf8'
                        : gpsState === 'DENIED' ? '#e11d48'
                        : gpsState === 'UNAVAILABLE' ? '#f59e0b'
                        : '#94a3b8'
                    }}>
                      {gpsState === 'ACTIVE' ? '🟢 Device GPS Active'
                        : gpsState === 'ACQUIRING' ? '🟡 Acquiring Fix...'
                        : gpsState === 'DENIED' ? '🔴 Permission Denied'
                        : gpsState === 'UNAVAILABLE' ? '⚠️ GPS Unavailable'
                        : '⚫ Standby'}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(10, 16, 26, 0.85)',
                  border: '1.5px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: 20,
                  padding: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, fontWeight: 900, color: '#94a3b8' }}>No Bus Assigned</span>
                    <span style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#94a3b8', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 9999 }}>
                      STANDBY
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    No active commercial duty or vehicle currently assigned to your account in the database.
                  </div>
                  <div style={{ fontSize: 12, color: '#38bdf8', marginTop: 6 }}>
                    Contact your fleet dispatcher to receive an assigned route duty.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loadDriverDuty}
                  style={{
                    padding: '10px 18px',
                    background: 'rgba(0, 212, 136, 0.12)',
                    border: '1px solid #00D488',
                    borderRadius: 10,
                    color: '#00D488',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ↻ Refresh Duty
                </button>
              </div>
            )}

            {/* Glanceable Operational HUD Cards (Large Text, High Contrast) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {/* Speedometer */}
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>CURRENT SPEED</div>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: '#00D488', lineHeight: 1.1, marginTop: 4 }}>
                  {speed}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 700 }}>km/h (Highway)</div>
              </div>

              {/* Next Stop + ETA */}
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(0, 212, 136, 0.25)', padding: '20px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>NEXT STOP</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                  {nextStop || (tripStatus === 'IN_TRANSIT' ? 'On Route' : 'Ready to Start')}
                </div>
                <div style={{ fontSize: 13, color: '#00D488', fontWeight: 800, marginTop: 4 }}>
                  {etaMins !== null ? `ETA: ${etaMins} mins` : (tripStatus === 'IN_TRANSIT' ? 'Live GPS Active' : 'Trip Not Started')}
                </div>
              </div>

              {/* Passenger Occupancy */}
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>PASSENGERS ONBOARD</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginTop: 4 }}>
                  {passengerCount} <span style={{ fontSize: '1.2rem', color: '#64748b' }}>/ {totalSeats}</span>
                </div>
                <div style={{ fontSize: 12, color: '#00D488', fontWeight: 700, marginTop: 2 }}>
                  {Math.round((passengerCount / totalSeats) * 100)}% Occupancy
                </div>
              </div>

              {/* Trip Time */}
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>TRIP DURATION</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, marginTop: 6 }}>
                  {Math.floor(tripMinutes / 60)}h {tripMinutes % 60}m
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Elapsed on route</div>
              </div>
            </div>

            {/* Primary Action Buttons (Large Touch Targets for Drivers) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 6 }}>
              {!busDetails || !activeTripId ? (
                <button
                  type="button"
                  disabled
                  style={{
                    padding: '20px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#64748b',
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    borderRadius: 16,
                    cursor: 'not-allowed',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                  }}
                >
                  <span>⏳</span>
                  <span>NO ACTIVE TRIP ASSIGNED (STANDBY)</span>
                </button>
              ) : tripStatus !== 'IN_TRANSIT' ? (
                <button
                  type="button"
                  onClick={handleStartTrip}
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                    color: '#ffffff',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    borderRadius: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    boxShadow: '0 6px 25px rgba(0, 184, 122, 0.4)',
                  }}
                >
                  <span style={{ fontSize: 24 }}>▶</span>
                  <span>START TRIP (START GPS STREAM)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEndTrip}
                  style={{
                    padding: '20px',
                    background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                    color: '#ffffff',
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    borderRadius: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    boxShadow: '0 6px 25px rgba(225, 29, 72, 0.4)',
                  }}
                >
                  <span style={{ fontSize: 22 }}>■</span>
                  <span>END TRIP (COMPLETE DUTY)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('MAP')}
                style={{
                  padding: '20px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1.5px solid rgba(0, 212, 136, 0.4)',
                  color: '#00D488',
                  fontSize: '1.15rem',
                  fontWeight: 900,
                  borderRadius: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <span>🗺️</span>
                <span>Open Fullscreen Radar Map ➔</span>
              </button>
            </div>
          </div>
        )}

        {/* ══ 2. LIVE TRIP / MAP SCREEN ══ */}
        {activeTab === 'MAP' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1080 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                  Live Highway Radar
                </h1>
                <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                  {busDetails ? `Transmitting real-time GPS coordinates for ${busDetails.reg}` : 'Awaiting trip assignment to transmit telemetry'}
                </p>
              </div>
              <div style={{ background: 'rgba(0, 212, 136, 0.15)', border: '1px solid #00D488', color: '#00D488', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 800 }}>
                Speed: {speed} km/h · Next: {nextStop || 'N/A'}
              </div>
            </div>

            {!coords && (
              <div style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 12,
                padding: '14px 18px',
                color: '#38bdf8',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span>🛰️</span>
                <span>
                  {gpsState === 'DENIED'
                    ? 'GPS permission denied. Please allow location access in your browser or device settings.'
                    : tripStatus !== 'IN_TRANSIT'
                    ? 'Start trip to activate real device GPS tracking and center map on your position.'
                    : 'Acquiring high-accuracy GPS fix from physical device...'}
                </span>
              </div>
            )}

            {coords ? (
              <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0, 212, 136, 0.35)', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
                <GoogleMapView
                  center={coords}
                  zoom={15}
                  height={580}
                  markers={mapMarkers}
                  followMarkerId="driver-bus"
                />
              </div>
            ) : (
              <div style={{
                borderRadius: 20,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(10, 16, 26, 0.6)',
                height: 580,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                color: '#94a3b8',
                textAlign: 'center',
                padding: 24,
              }}>
                <span style={{ fontSize: 36 }}>🛰️</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                  {gpsState === 'DENIED'
                    ? 'Location permission required'
                    : gpsState === 'UNAVAILABLE'
                    ? 'No live GPS data'
                    : 'Waiting for device GPS'}
                </div>
                <p style={{ fontSize: 13, maxWidth: 360, margin: 0, color: '#94a3b8' }}>
                  {gpsState === 'DENIED'
                    ? 'Please allow location permission in your device or browser settings to display live GPS navigation.'
                    : 'Real physical device coordinates will display here once GPS fix is acquired.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══ 3. ROUTE & STOPS SCREEN ══ */}
        {activeTab === 'STOPS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                Corridor Stops & Schedule
              </h1>
              <p style={{ fontSize: 14, color: isLight ? '#475569' : '#cbd5e1', marginTop: 4 }}>
                {busDetails ? `${busDetails.route} Scheduled Highway Stops` : 'No active corridor duty assigned'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stopsList.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', background: isLight ? '#f8fafc' : 'rgba(10, 16, 26, 0.5)', borderRadius: 16, border: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}` }}>
                  No scheduled route stoppages assigned. Stops will display when a trip duty is assigned.
                </div>
              ) : (
                stopsList.map((s, idx) => (
                  <div
                    key={s.id}
                    style={{
                      background: isLight
                        ? (s.isCurrent ? '#ecfdf5' : '#ffffff')
                        : (s.isCurrent ? 'rgba(10, 24, 20, 0.95)' : 'rgba(10, 16, 26, 0.85)'),
                      borderRadius: 16,
                      border: s.isCurrent
                        ? (isLight ? '2px solid #10b981' : '2px solid #00D488')
                        : (isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)'),
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.04)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: s.isPassed ? (isLight ? '#dcfce7' : '#00875A') : s.isCurrent ? '#00D488' : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.1)'),
                          color: s.isPassed ? (isLight ? '#15803d' : '#fff') : s.isCurrent ? '#000' : (isLight ? '#0f172a' : '#fff'),
                          fontWeight: 900,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          border: isLight ? '1px solid #cbd5e1' : 'none',
                        }}
                      >
                        {s.isPassed ? '✓' : idx + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: s.isCurrent ? (isLight ? '#047857' : '#00D488') : (isLight ? '#0f172a' : '#ffffff') }}>
                          {s.name} <span style={{ color: isLight ? '#475569' : '#cbd5e1', fontSize: 13 }}>({s.nameOd})</span>
                        </div>
                        <div style={{ fontSize: 12, color: isLight ? '#334155' : '#cbd5e1', marginTop: 2 }}>
                          {s.km} km from origin · Scheduled: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{s.time}</strong>
                        </div>
                      </div>
                    </div>

                    <div>
                      {s.isPassed && <span style={{ background: isLight ? '#dcfce7' : 'rgba(0, 212, 136, 0.15)', color: isLight ? '#15803d' : '#00D488', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>PASSED</span>}
                      {s.isCurrent && <span style={{ background: '#00D488', color: '#000', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 900 }}>NEXT STOP {etaMins !== null ? `(ETA ${etaMins}m)` : ''}</span>}
                      {!s.isPassed && !s.isCurrent && <span style={{ color: isLight ? '#475569' : '#cbd5e1', fontSize: 11, fontWeight: 700 }}>UPCOMING</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ══ 4. TRIP HISTORY SCREEN ══ */}
        {activeTab === 'HISTORY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Driver Trip History
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                Past completed commercial duty trips
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {tripHistory.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', background: 'rgba(10, 16, 26, 0.5)', borderRadius: 16, border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                  No completed commercial duty trips recorded yet.
                </div>
              ) : (
                tripHistory.map((trip) => (
                <div
                  key={trip.id}
                  style={{
                    background: 'rgba(10, 16, 26, 0.85)',
                    borderRadius: 18,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '18px 22px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
                      {trip.route}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                      Vehicle: <strong>{trip.busReg}</strong> · Date: {trip.date}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#00D488' }}>{trip.duration}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{trip.passengers} Passengers</div>
                    </div>
                    <span style={{ background: 'rgba(0, 212, 136, 0.15)', color: '#00D488', fontSize: 11, fontWeight: 900, padding: '4px 10px', borderRadius: 6 }}>
                      {trip.status}
                    </span>
                  </div>
                </div>
              )))}
            </div>
          </div>
        )}

        {/* ══ 5. PROFILE SCREEN ══ */}
        {activeTab === 'PROFILE' && (
          <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Driver Profile & Credentials
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                Commercial heavy passenger vehicle duty credentials
              </p>
            </div>

            <div
              style={{
                background: 'rgba(10, 16, 26, 0.85)',
                borderRadius: 24,
                border: '1px solid rgba(0, 212, 136, 0.25)',
                padding: 24,
                boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#00593b', border: '1px solid #00D488', color: '#00D488', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                  {user?.fullName ? user.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'DR'}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff' }}>{user?.fullName || 'Authorized Driver'}</div>
                  <div style={{ fontSize: 12, color: '#00D488', fontWeight: 700, marginTop: 2 }}>AUTHORISED COMMERCIAL DRIVER</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>ASSIGNED VEHICLE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{busDetails ? `${busDetails.reg} (${busDetails.name})` : 'No vehicle currently assigned'}</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>ASSIGNED ROUTE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{busDetails ? busDetails.route : 'No route currently assigned'}</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>REGISTERED MOBILE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{user?.phone || 'Not provided'}</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>COMMERCIAL LICENSE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#00D488', marginTop: 2 }}>{(user as any)?.licenseNumber || 'Commercial Heavy Passenger Vehicle'}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={logout}
                style={{
                  marginTop: 8,
                  padding: '14px',
                  backgroundColor: 'rgba(225, 29, 72, 0.18)',
                  border: '1px solid rgba(225, 29, 72, 0.4)',
                  borderRadius: 12,
                  color: '#fca5a5',
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>🚪</span>
                <span>Log Out of Duty</span>
              </button>
            </div>
          </div>
        )}
        </main>
      </div>

      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onConfirm={logout}
        onCancel={() => setIsLogoutConfirmOpen(false)}
        isLight={isLight}
      />
    </div>
  );
}
