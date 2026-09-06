import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAdminAuthStore } from '../stores/auth.store.js';
import { apiClient } from '../services/api.client.js';
import { GoogleMapView, MapMarker } from '../components/maps/GoogleMapView.js';
import { transitService, SearchBusResult, MasterStop } from '../services/transit.service.js';
import { TopHeader } from '../components/layout/TopHeader.js';
import { useThemeStore } from '../stores/theme.store.js';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal.js';

type PassengerNavTab = 'HOME' | 'FIND_BUS' | 'TICKETS' | 'PROFILE';


interface Ticket {
  id: string;
  routeCode: string;
  routeName: string;
  from: string;
  to: string;
  seat: number;
  fare: number;
  date: string;
  time: string;
  busReg: string;
  qrCode: string;
  status: string;
}

interface CityOption {
  id: string;
  name: string;
  nameOd: string;
  region: string;
  defaultFrom: string;
  defaultTo: string;
  lat: number;
  lng: number;
}

const AVAILABLE_CITIES: CityOption[] = [];

const QUICK_ROUTE_CHIPS: Array<{ from: string; to: string; label: string }> = [];

export function PassengerApp() {
  const { user, logout } = useAdminAuthStore();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';

  // Navigation: Default tab = HOME
  const [activeTab, setActiveTab] = useState<PassengerNavTab>('HOME');
  const [hasSearched, setHasSearched] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // City / Region Selector State
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [showCityModal, setShowCityModal] = useState(false);

  // Location / GPS Banner State
  const [showLocationBanner, setShowLocationBanner] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'enabled'>('idle');
  const [_userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Search Fields
  const [fromStop, setFromStop] = useState('');
  const [toStop, setToStop] = useState('');
  const [travelDate, setTravelDate] = useState('30-08-2026');
  const [sortBy, setSortBy] = useState<'Arrival Time' | 'Fare' | 'Speed'>('Arrival Time');
  const [lastUpdatedTime, setLastUpdatedTime] = useState('18:53:12');

  // Autocomplete Suggestions State
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);

  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  // Bus Results & Tracking State (INITIAL LOAD SHOWS NO BUSES)
  const [buses, setBuses] = useState<SearchBusResult[]>([]);
  const [focusedBusId, setFocusedBusId] = useState<string>('');
  const [selectedTrackingBus, setSelectedTrackingBus] = useState<SearchBusResult | null>(null);
  const [trackedLiveLocation, setTrackedLiveLocation] = useState<{
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    lastUpdated: string;
  } | null>(null);
  const [trackedFreshness, setTrackedFreshness] = useState<'LIVE' | 'STALE' | 'OFFLINE' | 'NO_DATA'>('NO_DATA');
  const [isSearching, setIsSearching] = useState(false);

  // Modals
  const [showBuyTicketModal, setShowBuyTicketModal] = useState(false);
  const [showAllStopsModal, setShowAllStopsModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);

  // Mobile Ticket Booking State
  const [bookingFrom, setBookingFrom] = useState('');
  const [bookingTo, setBookingTo] = useState('');
  const [bookingPassengers, setBookingPassengers] = useState(1);
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<'UPI' | 'WALLET' | 'CARD'>('UPI');

  // Passenger Tickets History
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Real Backend Discovery Stops (Only stops with active/published trips)
  const [discoveryStops, setDiscoveryStops] = useState<MasterStop[]>([]);

  const loadDiscoveryStops = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/discovery/stops').catch(() => null);
      if (res?.data?.success && Array.isArray(res.data?.data?.stops)) {
        const mapped: MasterStop[] = res.data.data.stops.map((s: any, idx: number) => ({
          id: s.id,
          name: s.name,
          nameOd: s.name,
          lat: s.location?.latitude ?? s.latitude ?? 0,
          lng: s.location?.longitude ?? s.longitude ?? 0,
          km: s.km ?? (idx === 0 ? 0 : 50),
          code: s.code || `STP-${idx + 1}`,
        }));
        setDiscoveryStops(mapped);
      } else {
        setDiscoveryStops([]);
      }
    } catch {
      setDiscoveryStops([]);
    }
  }, []);

  useEffect(() => {
    loadDiscoveryStops();
    const handleEvents = () => loadDiscoveryStops();
    window.addEventListener('ruralbus:stops-updated', handleEvents);
    return () => window.removeEventListener('ruralbus:stops-updated', handleEvents);
  }, [loadDiscoveryStops]);

  // Master buses for corridor radar preview & nearest bus stop
  const corridorBuses = useMemo(() => {
    return transitService.getBuses();
  }, []);

  // Nearest stop data based on active device location
  const nearestStop = useMemo<MasterStop | null>(() => {
    if (_userLocation && discoveryStops.length > 0) {
      let closest = discoveryStops[0];
      let minDist = Infinity;
      discoveryStops.forEach((s) => {
        const dist = Math.hypot(s.lat - _userLocation.lat, s.lng - _userLocation.lng);
        if (dist < minDist) {
          minDist = dist;
          closest = s;
        }
      });
      return closest;
    }
    return discoveryStops[0] || null;
  }, [_userLocation, discoveryStops]);

  // Active City Center Coordinates (strictly real device GPS)
  const cityCenter = useMemo(() => {
    return _userLocation;
  }, [_userLocation]);

  // Acquire real device location on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setGpsStatus('locating');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsStatus('enabled');
        },
        () => {
          setGpsStatus('idle');
        },
        { timeout: 8000, maximumAge: 30000 }
      );
    }
  }, []);

  // Corridor map markers for "Buses around you" preview (only active running buses with valid coordinates)
  const corridorMapMarkers: MapMarker[] = useMemo(() => {
    return corridorBuses
      .filter((bus) => bus.status === 'Running' && bus.lat !== 0 && bus.lng !== 0)
      .map((bus) => ({
        id: bus.id,
        lat: bus.lat,
        lng: bus.lng,
        title: bus.name,
        subtitle: `${bus.reg} · ${bus.speed > 0 ? `${bus.speed} km/h` : 'Scheduled'}`,
        type: 'BUS',
        speed: bus.speed,
        status: bus.status === 'Running' ? 'RUNNING' : bus.status === 'Slowed' ? 'HALTED' : 'STOPPED',
        nextStop: bus.nextStop,
      }));
  }, [corridorBuses]);

  // Listen for real-time stoppage updates from Owner (only refreshes if user has active search)
  useEffect(() => {
    const handleStopsUpdated = () => {
      loadDiscoveryStops();
      if (hasSearched && fromStop && toStop) {
        executeBusSearch(fromStop, toStop, travelDate);
      }
    };

    window.addEventListener('ruralbus:stops-updated', handleStopsUpdated);
    return () => window.removeEventListener('ruralbus:stops-updated', handleStopsUpdated);
  }, [hasSearched, fromStop, toStop, travelDate, loadDiscoveryStops]);

  // Handle outside click for autocomplete dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fromRef.current && !fromRef.current.contains(event.target as Node)) {
        setShowFromSuggestions(false);
      }
      if (toRef.current && !toRef.current.contains(event.target as Node)) {
        setShowToSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered Place Suggestions (Only from published trips)
  const fromSuggestions = useMemo(() => {
    const q = fromStop.trim().toLowerCase();
    if (!q) return discoveryStops;
    return discoveryStops.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q)
    );
  }, [fromStop, discoveryStops]);

  const toSuggestions = useMemo(() => {
    const q = toStop.trim().toLowerCase();
    if (!q) return discoveryStops;
    return discoveryStops.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q)
    );
  }, [toStop, discoveryStops]);

  // Load Real Passenger Tickets from Backend
  const loadPassengerTickets = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/v1/bookings/my-bookings').catch(() => null);
      if (res?.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
        const mapped: Ticket[] = res.data.data.map((b: any) => ({
          id: b.id?.slice(0, 8) || `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
          routeCode: b.trip?.route?.routeCode || 'Transit Route',
          routeName: `${b.boardingStop?.name || 'Origin'} → ${b.droppingStop?.name || 'Destination'}`,
          from: b.boardingStop?.name || 'Origin',
          to: b.droppingStop?.name || 'Destination',
          seat: b.seatNumber || 1,
          fare: b.fareAmount || 0,
          date: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Recent',
          time: 'Scheduled',
          busReg: b.trip?.bus?.registrationNumber || 'Assigned Bus',
          qrCode: `RURALBUS-${b.trip?.bus?.registrationNumber || 'BUS'}-S${b.seatNumber}-${b.id?.slice(0, 6)}`,
          status: 'CONFIRMED',
        }));
        setTickets(mapped);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadPassengerTickets();
  }, [loadPassengerTickets]);

  // Real Backend GPS Polling for selectedTrackingBus
  useEffect(() => {
    if (!selectedTrackingBus) {
      setTrackedLiveLocation(null);
      setTrackedFreshness('NO_DATA');
      return;
    }

    const tripId = selectedTrackingBus.tripId;
    let isCancelled = false;

    async function pollLiveLocation() {
      if (!tripId) return;
      try {
        const res = await apiClient.get(`/api/v1/tracking/trip/${tripId}`).catch(() => null);
        if (isCancelled) return;
        const resData = res?.data?.data;
        if (resData) {
          setTrackedFreshness(resData.freshness || 'NO_DATA');
          if (resData.location) {
            setTrackedLiveLocation({
              latitude: resData.location.latitude,
              longitude: resData.location.longitude,
              speed: resData.location.speed ?? 0,
              heading: resData.location.heading ?? 0,
              lastUpdated: resData.location.lastUpdated,
            });
          } else {
            setTrackedLiveLocation(null);
          }
        }
      } catch {}
    }

    pollLiveLocation();
    const interval = setInterval(pollLiveLocation, 3000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [selectedTrackingBus]);

  // Execute Search: Fetches results, sets hasSearched = true, and switches view
  const executeBusSearch = async (from: string, to: string, date: string) => {
    setIsSearching(true);
    setShowFromSuggestions(false);
    setShowToSuggestions(false);
    setLastUpdatedTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    try {
      const res = await apiClient.get('/api/v1/discovery/routes', {
        params: { origin: from, destination: to, date: date },
      }).catch(() => null);

      if (res?.data?.data?.trips && Array.isArray(res.data.data.trips) && res.data.data.trips.length > 0) {
        const backendBuses: SearchBusResult[] = res.data.data.trips.map((t: any, i: number) => ({
          id: t.id || `b${i + 1}`,
          tripId: t.id,
          busName: t.busModel || t.operatorName || 'Scheduled Transit Bus',
          busReg: t.busRegistrationNumber || 'Bus',
          type: t.seatingType || 'Express Bus',
          routeCode: t.routeCode || t.route?.routeCode || 'Commercial Route',
          via: t.route?.via || 'Highway Corridor',
          from: from,
          to: to,
          departure: t.departureTime ? new Date(t.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Scheduled',
          arrival: t.arrivalTime ? new Date(t.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Scheduled',
          arrivingIn: t.status === 'IN_TRANSIT' ? 'In Transit' : 'Scheduled',
          arrivingAt: `(At ${to})`,
          duration: t.estimatedDurationMinutes ? `${Math.floor(t.estimatedDurationMinutes / 60)}h ${t.estimatedDurationMinutes % 60}m` : 'Scheduled',
          fare: t.fareAmount || 50,
          status: t.status === 'IN_TRANSIT' ? 'Running' : 'Offline',
          speed: 0,
          currentLocation: t.status === 'IN_TRANSIT' ? 'In Transit' : 'Scheduled Departure',
          nextStop: '',
          etaMinutes: 20 + i * 10,
          iconColor: '#38bdf8',
          iconBg: 'rgba(56, 189, 248, 0.15)',
          lat: 0,
          lng: 0,
        }));
        setBuses(backendBuses);
        if (backendBuses.length > 0) setFocusedBusId(backendBuses[0].id);
      } else {
        setBuses([]);
        setFocusedBusId('');
      }
    } catch {
      setBuses([]);
      setFocusedBusId('');
    } finally {
      setIsSearching(false);
      setHasSearched(true);
      setActiveTab('FIND_BUS');
    }
  };

  const handleSearchBuses = () => {
    executeBusSearch(fromStop, toStop, travelDate);
  };

  const handleQuickRouteSearch = (from: string, to: string) => {
    setFromStop(from);
    setToStop(to);
    executeBusSearch(from, to, travelDate);
  };

  const handleSwapStops = () => {
    const temp = fromStop;
    setFromStop(toStop);
    setToStop(temp);
  };

  // Clear Search: Restores the clean initial Home state without any buses listed
  const handleClearSearch = () => {
    setHasSearched(false);
    setBuses([]);
    setActiveTab('HOME');
  };

  // Location / GPS Activation Handler (Only activates on user interaction, never on initial mount)
  const handleEnableLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setGpsStatus('locating');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsStatus('enabled');
          // Find closest known published transit stop
          if (discoveryStops.length > 0) {
            let closest = discoveryStops[0];
            let minDist = Infinity;
            discoveryStops.forEach((s) => {
              const dist = Math.hypot(s.lat - pos.coords.latitude, s.lng - pos.coords.longitude);
              if (dist < minDist) {
                minDist = dist;
                closest = s;
              }
            });
            if (closest) {
              setFromStop(closest.name);
            }
          }
        },
        () => {
          setGpsStatus('enabled');
        },
        { timeout: 8000 }
      );
    } else {
      setGpsStatus('enabled');
    }
  };

  // Telemetry Clock Updates (ONLY active when user is viewing search results or actively tracking a bus)
  useEffect(() => {
    if (!hasSearched && !selectedTrackingBus) return;

    function updateClock() {
      setLastUpdatedTime(
        new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }

    const interval = setInterval(updateClock, 5000);
    return () => clearInterval(interval);
  }, [hasSearched, selectedTrackingBus]);

  // Sorted Buses
  const sortedBuses = useMemo(() => {
    const list = [...buses];
    if (sortBy === 'Arrival Time') {
      list.sort((a, b) => a.etaMinutes - b.etaMinutes);
    } else if (sortBy === 'Fare') {
      list.sort((a, b) => a.fare - b.fare);
    } else if (sortBy === 'Speed') {
      list.sort((a, b) => b.speed - a.speed);
    }
    return list;
  }, [buses, sortBy]);

  // Focused Bus
  const focusedBus = useMemo(() => {
    return (
      buses.find((b) => b.id === focusedBusId) ||
      buses[0] || {
        id: '',
        busName: 'Scheduled Bus',
        busReg: '--',
        speed: 0,
        lat: 0,
        lng: 0,
        nextStop: '',
      }
    );
  }, [buses, focusedBusId]);

  // Dynamic Stoppage Timeline for Tracked Bus
  const trackingTimelineStops = useMemo(() => {
    if (!selectedTrackingBus) return [];
    const busStops = (selectedTrackingBus as any).stops;
    if (busStops && Array.isArray(busStops) && busStops.length > 0) {
      return busStops.map((s: any, idx: number) => ({
        name: typeof s === 'string' ? s : s.name || `Stop ${idx + 1}`,
        nameOd: typeof s === 'string' ? s : s.nameOd || s.name || `Stop ${idx + 1}`,
        km: s.km ?? idx * 10,
        time: s.time || `Scheduled`,
      }));
    }
    return [];
  }, [selectedTrackingBus]);

  // Map Markers for Search Results
  const mapMarkers: MapMarker[] = useMemo(() => {
    return buses
      .filter((bus) => bus.lat !== 0 && bus.lng !== 0)
      .map((bus) => ({
        id: bus.id,
        lat: bus.lat,
        lng: bus.lng,
        title: bus.busName,
        subtitle: `${bus.busReg} · ${bus.speed} km/h`,
        type: 'BUS',
        speed: bus.speed,
        status: bus.status === 'Running' ? 'RUNNING' : bus.status === 'Slowed' ? 'HALTED' : 'STOPPED',
        nextStop: bus.nextStop,
      }));
  }, [buses]);

  // Instant Ticket Booking Submit
  const handleConfirmBookTicket = () => {
    const fareResult = transitService.calculateSegmentFare(bookingFrom, bookingTo);
    const totalFare = fareResult.fare * bookingPassengers;
    const newTicket: Ticket = {
      id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      routeCode: 'Highway Express',
      routeName: `${bookingFrom} → ${bookingTo}`,
      from: bookingFrom,
      to: bookingTo,
      seat: Math.floor(1 + Math.random() * 30),
      fare: totalFare,
      date: travelDate,
      time: 'Scheduled',
      busReg: 'Assigned Bus',
      qrCode: `RURALBUS-TKT-${Date.now().toString().slice(-6)}`,
      status: 'CONFIRMED',
    };
    setTickets((prev) => [newTicket, ...prev]);
    setShowBuyTicketModal(false);
    setActiveTab('TICKETS');
  };

  return (
    <div
      className="app-shell"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: isLight ? '#f8fafc' : '#050a0f',
        color: isLight ? '#0f172a' : '#ffffff',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ── 4-ITEM FIXED LEFT SIDEBAR ── */}
      <aside
        style={{
          width: 260,
          backgroundColor: isLight ? '#ffffff' : '#04080e',
          borderRight: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
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
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #00D488 0%, #00875A 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                boxShadow: '0 4px 16px rgba(0,212,136,0.3)',
              }}
            >
              🚌
            </div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.5, color: isLight ? '#0f172a' : '#ffffff' }}>
                RURAL<span style={{ color: '#00D488' }}>BUS</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00D488', letterSpacing: 0.5 }}>
                Passenger App
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
              backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
              border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.15)',
              color: isLight ? '#0f172a' : '#ffffff',
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

        {/* 4 Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {[
            { id: 'HOME', icon: '🏠', label: 'Home' },
            { id: 'FIND_BUS', icon: '🔍', label: 'Find Bus' },
            { id: 'TICKETS', icon: '🎫', label: 'My Tickets' },
            { id: 'PROFILE', icon: '👤', label: 'Profile' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'HOME') {
                    // Clicking Home restores clean Home state
                    setHasSearched(false);
                    setBuses([]);
                  }
                  setActiveTab(item.id as PassengerNavTab);
                  setIsMobileNavOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 16px',
                  borderRadius: 12,
                  backgroundColor: isActive
                    ? (isLight ? '#ecfdf5' : 'rgba(0, 212, 136, 0.12)')
                    : 'transparent',
                  border: isActive
                    ? (isLight ? '1.5px solid #059669' : '1px solid #00D488')
                    : '1px solid transparent',
                  color: isActive
                    ? (isLight ? '#047857' : '#00D488')
                    : (isLight ? '#475569' : '#cbd5e1'),
                  fontSize: '0.96rem',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 17 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Card & Sign Out */}
        <div style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#00593b',
                color: '#00D488',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 13,
                border: '1px solid rgba(0, 212, 136, 0.3)',
              }}
            >
              RS
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: isLight ? '#0f172a' : '#ffffff',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {user?.fullName || 'Rajesh Sharma'}
              </div>
              <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#64748b' }}>
                {user?.phone || '9876500001'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsLogoutConfirmOpen(true)}
            style={{
              width: '100%',
              padding: '11px',
              backgroundColor: isLight ? '#fee2e2' : 'rgba(225, 29, 72, 0.12)',
              border: isLight ? '1px solid #fca5a5' : '1px solid rgba(225, 29, 72, 0.25)',
              borderRadius: 10,
              color: isLight ? '#b91c1c' : '#fca5a5',
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
          icon="🚌"
          roleBadge="PASSENGER"
          roleBadgeColor="#00D488"
          roleBadgeBg="rgba(0, 212, 136, 0.15)"
          portalTitle="Passenger Portal"
          portalSubtitle="Live Bus Telemetry & Online Seat Reservation"
          activeViewTitle={
            hasSearched
              ? 'Search Results & Live Radar'
              : activeTab === 'FIND_BUS'
              ? 'Find Bus & Corridor Search'
              : activeTab === 'HOME'
              ? 'Home & Live Radar'
              : activeTab === 'TICKETS'
              ? `My Booked Tickets (${tickets.length})`
              : 'Passenger Profile'
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
          {/* ═════════════════════════════════════════════════════════════════════════
              ══ 1. HOME SCREEN (CHALO-INSPIRED FEATURES + RURALBUS GREEN THEME) ══
              ═════════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'HOME' && !hasSearched && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100, width: '100%', margin: '0 auto' }}>

              {/* 1.1 Top Header Row: Greeting & City/Region Selector Pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <h1 style={{ fontSize: '1.65rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0, letterSpacing: -0.5 }}>
                    Welcome, {user?.fullName?.split(' ')[0] || 'Rajesh'} 👋
                  </h1>
                  <p style={{ fontSize: '0.9rem', color: isLight ? '#64748b' : '#94a3b8', margin: '4px 0 0 0' }}>
                    Real-Time Bus & Highway Corridor Portal
                  </p>
                </div>

                {/* City Selector Pill */}
                <button
                  type="button"
                  onClick={() => setShowCityModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 18px',
                    borderRadius: 9999,
                    backgroundColor: isLight ? '#ffffff' : 'rgba(10, 20, 30, 0.85)',
                    border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.35)'}`,
                    color: isLight ? '#0f172a' : '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.06)' : '0 4px 16px rgba(0, 0, 0, 0.4)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Switch Active Transit City/Region"
                >
                  <span style={{ color: '#00D488', fontSize: 16 }}>📍</span>
                  <span>{selectedCity || 'Current Location'}</span>
                  <span style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8' }}>⌵</span>
                </button>
              </div>

              {/* 1.2 Dismissible Location / GPS Permission Banner */}
              {showLocationBanner && (
                <div
                  style={{
                    background: isLight ? '#f0fdf4' : 'rgba(10, 22, 28, 0.95)',
                    border: `1.5px solid ${isLight ? '#86efac' : 'rgba(0, 212, 136, 0.35)'}`,
                    borderRadius: 16,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    boxShadow: isLight ? '0 2px 10px rgba(5, 150, 105, 0.08)' : '0 10px 25px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: 'rgba(0, 212, 136, 0.15)',
                        border: '1px solid rgba(0, 212, 136, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      📍
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>
                        Turn on location for nearby services
                      </div>
                      <div style={{ fontSize: 12, color: isLight ? '#475569' : '#94a3b8', marginTop: 2 }}>
                        Please turn on or update your location for accessing services and nearest stops around you.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowLocationBanner(false)}
                      style={{
                        padding: '6px 14px',
                        background: 'transparent',
                        border: 'none',
                        color: isLight ? '#64748b' : '#94a3b8',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={handleEnableLocation}
                      style={{
                        padding: '7px 16px',
                        background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                        border: 'none',
                        borderRadius: 8,
                        color: '#ffffff',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 10px rgba(0, 184, 122, 0.3)',
                      }}
                    >
                      <span>{gpsStatus === 'locating' ? 'Locating…' : gpsStatus === 'enabled' ? '✓ GPS Active' : 'Turn on GPS ➔'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 1.3 Hero Search Card: "Find and track your bus" with Quick Route Chips */}
              <div
                style={{
                  background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                  border: isLight ? '1.5px solid #e2e8f0' : '1px solid rgba(0, 212, 136, 0.3)',
                  boxShadow: isLight ? '0 4px 20px rgba(15, 23, 42, 0.06)' : '0 15px 35px rgba(0,0,0,0.5)',
                  borderRadius: 20,
                  padding: '22px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {/* Hero Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: 'rgba(0, 212, 136, 0.12)',
                      border: '1.5px solid rgba(0, 212, 136, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      color: '#00D488',
                    }}
                  >
                    🔍
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                      Find and track your bus
                    </h2>
                    <div style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                      Search corridor routes, check seats, and track live satellite radar
                    </div>
                  </div>
                </div>

                {/* Search Inputs Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                    alignItems: 'end',
                  }}
                >
                  {/* FROM Input */}
                  <div ref={fromRef} style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#1e293b' : '#cbd5e1', textTransform: 'uppercase', marginBottom: 6 }}>
                      From (Starting Stop)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: 10, padding: '0 14px' }}>
                      <input
                        type="text"
                        value={fromStop}
                        onFocus={() => setShowFromSuggestions(true)}
                        onChange={(e) => {
                          setFromStop(e.target.value);
                          setShowFromSuggestions(true);
                        }}
                        placeholder="Starting stop..."
                        style={{ width: '100%', padding: '12px 0', background: 'transparent', border: 'none', color: isLight ? '#0f172a' : '#ffffff', fontSize: 14, fontWeight: 600, outline: 'none' }}
                      />
                      <span style={{ color: '#00D488', fontSize: 14 }}>📍</span>
                    </div>

                    {showFromSuggestions && (
                      <div
                        className="autocomplete-dropdown"
                        style={{
                          position: 'absolute',
                          top: '105%',
                          left: 0,
                          right: 0,
                          backgroundColor: isLight ? '#ffffff' : 'rgba(10, 18, 26, 0.98)',
                          backdropFilter: 'blur(20px)',
                          border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.3)'}`,
                          borderRadius: 12,
                          maxHeight: 220,
                          overflowY: 'auto',
                          zIndex: 2000,
                          boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                        }}
                      >
                        {fromSuggestions.length === 0 ? (
                          <div style={{ padding: '14px 16px', color: isLight ? '#64748b' : '#94a3b8', fontSize: 12, textAlign: 'center' }}>
                            No active bus routes or published trips available.
                          </div>
                        ) : (
                          fromSuggestions.map((s) => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setFromStop(s.name);
                                setShowFromSuggestions(false);
                              }}
                              style={{
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.05)',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: '#00D488', fontSize: 13 }}>📍</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff' }}>{s.name}</span>
                                <span style={{ fontSize: 11, color: '#00D488', fontWeight: 600 }}>({s.nameOd})</span>
                              </div>
                              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{s.km} km</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Swap Button */}
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingBottom: 6 }}>
                    <button
                      type="button"
                      onClick={handleSwapStops}
                      title="Swap Origin and Destination"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                        border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)'}`,
                        color: '#00D488',
                        fontSize: 16,
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ⇄
                    </button>
                  </div>

                  {/* TO Input */}
                  <div ref={toRef} style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#1e293b' : '#cbd5e1', textTransform: 'uppercase', marginBottom: 6 }}>
                      To (Destination)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: 10, padding: '0 14px' }}>
                      <input
                        type="text"
                        value={toStop}
                        onFocus={() => setShowToSuggestions(true)}
                        onChange={(e) => {
                          setToStop(e.target.value);
                          setShowToSuggestions(true);
                        }}
                        placeholder="Destination..."
                        style={{ width: '100%', padding: '12px 0', background: 'transparent', border: 'none', color: isLight ? '#0f172a' : '#ffffff', fontSize: 14, fontWeight: 600, outline: 'none' }}
                      />
                      <span style={{ color: '#00D488', fontSize: 14 }}>📍</span>
                    </div>

                    {showToSuggestions && (
                      <div
                        className="autocomplete-dropdown"
                        style={{
                          position: 'absolute',
                          top: '105%',
                          left: 0,
                          right: 0,
                          backgroundColor: isLight ? '#ffffff' : 'rgba(10, 18, 26, 0.98)',
                          backdropFilter: 'blur(20px)',
                          border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.3)'}`,
                          borderRadius: 12,
                          maxHeight: 220,
                          overflowY: 'auto',
                          zIndex: 2000,
                          boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                        }}
                      >
                        {toSuggestions.length === 0 ? (
                          <div style={{ padding: '14px 16px', color: isLight ? '#64748b' : '#94a3b8', fontSize: 12, textAlign: 'center' }}>
                            No active bus routes or published trips available.
                          </div>
                        ) : (
                          toSuggestions.map((s) => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setToStop(s.name);
                                setShowToSuggestions(false);
                              }}
                              style={{
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.05)',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: '#00D488', fontSize: 13 }}>📍</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff' }}>{s.name}</span>
                                <span style={{ fontSize: 11, color: '#00D488', fontWeight: 600 }}>({s.nameOd})</span>
                              </div>
                              <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{s.km} km</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Travel Date */}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#1e293b' : '#cbd5e1', textTransform: 'uppercase', marginBottom: 6 }}>
                      Date of Journey
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: 10, padding: '0 14px' }}>
                      <input
                        type="text"
                        value={travelDate}
                        onChange={(e) => setTravelDate(e.target.value)}
                        style={{ width: '100%', padding: '12px 0', background: 'transparent', border: 'none', color: isLight ? '#0f172a' : '#ffffff', fontSize: 14, fontWeight: 600, outline: 'none' }}
                      />
                      <span style={{ color: '#64748b', fontSize: 14 }}>📅</span>
                    </div>
                  </div>

                  {/* Search Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleSearchBuses}
                      disabled={isSearching}
                      style={{
                        width: '100%',
                        height: 46,
                        padding: '0 20px',
                        background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: 800,
                        borderRadius: 12,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 16px rgba(0, 184, 122, 0.35)',
                        border: 'none',
                      }}
                    >
                      <span>🔍</span>
                      <span>{isSearching ? 'Searching…' : 'Search Buses'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Route Chips */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Popular Corridor Routes (Tap to search):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {QUICK_ROUTE_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => handleQuickRouteSearch(chip.from, chip.to)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 9999,
                          backgroundColor: isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.65)',
                          border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.25)'}`,
                          color: isLight ? '#0f172a' : '#cbd5e1',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ color: '#00D488' }}>🚏</span>
                        <span>{chip.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 1.4 Divider: QUICK PAYMENTS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, backgroundColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)' }} />
                <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: isLight ? '#64748b' : '#94a3b8', textTransform: 'uppercase' }}>
                  ✦ QUICK PAYMENTS & PASSES ✦
                </span>
                <div style={{ flex: 1, height: 1, backgroundColor: isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)' }} />
              </div>

              {/* Quick Payments 3-Card Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                {/* 1. Buy Mobile Ticket */}
                <div
                  onClick={() => setShowBuyTicketModal(true)}
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                    borderRadius: 16,
                    border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.3)'}`,
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.04)' : '0 10px 25px rgba(0,0,0,0.3)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, rgba(0, 212, 136, 0.2) 0%, rgba(0, 135, 90, 0.2) 100%)',
                        border: '1px solid rgba(0, 212, 136, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        color: '#00D488',
                      }}
                    >
                      🎟️
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>
                        Buy mobile ticket
                      </div>
                      <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                        Pay with wallet, UPI or cards
                      </div>
                    </div>
                  </div>
                  <span style={{ color: '#00D488', fontSize: 16, fontWeight: 900 }}>➔</span>
                </div>

                {/* 2. My Tickets / Passes */}
                <div
                  onClick={() => setActiveTab('TICKETS')}
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                    borderRadius: 16,
                    border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)'}`,
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.04)' : '0 10px 25px rgba(0,0,0,0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        color: '#38bdf8',
                      }}
                    >
                      🎫
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>
                        My tickets / passes ({tickets.length})
                      </div>
                      <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                        Active QR boarding passes
                      </div>
                    </div>
                  </div>
                  <span style={{ color: '#38bdf8', fontSize: 16, fontWeight: 900 }}>➔</span>
                </div>

                {/* 3. Daily Corridor Pass */}
                <div
                  onClick={() => setShowPassModal(true)}
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                    borderRadius: 16,
                    border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)'}`,
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.04)' : '0 10px 25px rgba(0,0,0,0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'rgba(250, 204, 21, 0.15)',
                        border: '1px solid rgba(250, 204, 21, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        color: '#facc15',
                      }}
                    >
                      ⚡
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>
                        Daily Corridor Pass
                      </div>
                      <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                        Unlimited travel · From ₹99
                      </div>
                    </div>
                  </div>
                  <span style={{ color: '#facc15', fontSize: 16, fontWeight: 900 }}>➔</span>
                </div>
              </div>

              {/* 1.5 Nearest Bus Stop Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                    Nearest bus stop
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAllStopsModal(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#00D488',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>See all stops</span>
                    <span>➔</span>
                  </button>
                </div>

                {/* Nearest Stop Card */}
                {nearestStop ? (
                  <div
                    style={{
                      background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                      borderRadius: 18,
                      border: isLight ? '1.5px solid #e2e8f0' : '1px solid rgba(0, 212, 136, 0.25)',
                      overflow: 'hidden',
                      boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : '0 10px 25px rgba(0,0,0,0.4)',
                    }}
                  >
                    {/* Stop Header */}
                    <div
                      style={{
                        padding: '16px 20px',
                        borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            background: 'rgba(0, 212, 136, 0.15)',
                            color: '#00D488',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                          }}
                        >
                          🚏
                        </div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>
                            {nearestStop.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#00D488', fontWeight: 700 }}>
                            {nearestStop.nameOd ? `${nearestStop.nameOd} · ` : ''}Highway Marker {nearestStop.km} km
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '6px 12px',
                          background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          color: isLight ? '#475569' : '#cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>🚶</span>
                        <span>1 min away (90m)</span>
                      </div>
                    </div>

                    {/* Arriving Buses List inside the Stop Card (Using real corridor bus data) */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {corridorBuses.slice(0, 2).map((bus, idx) => (
                        <div
                          key={bus.id}
                          style={{
                            padding: '16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: idx === 0 ? (isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.05)') : 'none',
                            flexWrap: 'wrap',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                backgroundColor: bus.iconBg,
                                color: bus.iconColor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 18,
                              }}
                            >
                              🚌
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ background: '#0284c7', color: '#ffffff', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>
                                  {bus.type.includes('AC') ? 'AC' : 'EXP'}
                                </span>
                                <span style={{ fontSize: 15, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>
                                  {bus.routeCode}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#334155' : '#cbd5e1' }}>
                                  To {bus.stops[bus.stops.length - 1] || 'Destination'}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 3 }}>
                                {bus.name} ({bus.reg}) · Standard Seating Available
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 900, color: '#00D488', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>📶</span>
                                <span>In {5 + idx * 4} min</span>
                              </div>
                              <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                                Fare: ₹{bus.baseFare}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const dest = bus.stops[bus.stops.length - 1] || '';
                                const resultBus = dest ? transitService.searchBuses(nearestStop.name, dest, travelDate)[0] : null;
                                if (resultBus) setSelectedTrackingBus(resultBus);
                              }}
                              style={{
                                padding: '8px 14px',
                                background: 'rgba(0, 212, 136, 0.12)',
                                border: '1px solid rgba(0, 212, 136, 0.35)',
                                borderRadius: 8,
                                color: '#00D488',
                                fontSize: 12,
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              Track ➔
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Card Bottom CTA */}
                    <div
                      onClick={() => {
                        const dest = corridorBuses[0]?.stops[corridorBuses[0]?.stops.length - 1] || '';
                        if (dest) handleQuickRouteSearch(nearestStop.name, dest);
                      }}
                      style={{
                        padding: '12px 20px',
                        background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)',
                        borderTop: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        color: '#00D488',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      <span>See all buses passing {nearestStop.name}</span>
                      <span>➔</span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                      borderRadius: 18,
                      border: isLight ? '1.5px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '32px 20px',
                      textAlign: 'center',
                      color: isLight ? '#64748b' : '#94a3b8',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    No stops available
                  </div>
                )}
              </div>

              {/* 1.6 Compact "Buses Around You" Live Map Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                    Buses around you
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(0, 212, 136, 0.12)',
                      border: '1px solid rgba(0, 212, 136, 0.3)',
                      borderRadius: 20,
                      padding: '4px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      color: '#00D488',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D488', boxShadow: '0 0 6px #00D488' }} />
                    <span>{corridorBuses.length} Fleet Vehicles Live</span>
                  </div>
                </div>

                <div
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                    borderRadius: 18,
                    border: isLight ? '1.5px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                    overflow: 'hidden',
                    boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : '0 15px 35px rgba(0,0,0,0.5)',
                  }}
                >
                  {cityCenter ? (
                    <GoogleMapView
                      center={cityCenter}
                      zoom={11}
                      height={280}
                      markers={corridorMapMarkers}
                    />
                  ) : (
                    <div
                      style={{
                        height: 280,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.6)',
                        color: isLight ? '#64748b' : '#94a3b8',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 32 }}>📡</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Waiting for device GPS</span>
                      <span style={{ fontSize: 11, color: isLight ? '#94a3b8' : '#64748b' }}>Location not available</span>
                    </div>
                  )}

                  {/* Map Footer Bar */}
                  <div
                    style={{
                      padding: '10px 18px',
                      background: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: isLight ? '#64748b' : '#94a3b8',
                      fontWeight: 700,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D488' }} /> Running
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} /> Slowed
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748b' }} /> Scheduled
                      </span>
                    </div>

                    <div style={{ color: '#00D488' }}>
                      Tap Search Buses above for full synchronized route tracking
                    </div>
                  </div>
                </div>
              </div>

              {/* 1.7 Footer: Crafted with love */}
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 0 12px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#475569' : '#94a3b8' }}>
                  Making rural travel better for everyone
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: isLight ? '#64748b' : '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Crafted with love</span>
                  <span style={{ color: '#00D488' }}>💚</span>
                  <span>· Rural Bus Transport (RURALBUS)</span>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════════
              ══ 2. SEARCH RESULTS & LIVE BUS TRACKING VIEW ══
              ═════════════════════════════════════════════════════════════════════════ */}
          {(hasSearched || activeTab === 'FIND_BUS') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>

              {/* Top Bar with Clear Search / Back to Home Button */}
              <div className="page-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      style={{
                        padding: '6px 14px',
                        background: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
                        border: '1.5px solid #00D488',
                        borderRadius: 8,
                        color: '#00D488',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 8px rgba(0, 212, 136, 0.2)',
                      }}
                    >
                      <span>←</span>
                      <span>Clear Search / Back to Home</span>
                    </button>
                  </div>

                  <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                    {hasSearched ? 'Search Results' : 'Find Bus & Corridor Radar'}
                  </h1>
                  <div style={{ fontSize: 13, color: isLight ? '#475569' : '#94a3b8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{fromStop} ➔ {toStop}</span>
                    <span style={{ color: '#00D488' }}>•</span>
                    <span>📅 {travelDate}</span>
                  </div>
                </div>

                {/* Right: Live Updates pill + Last updated + refresh button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0, 212, 136, 0.12)', border: '1px solid rgba(0, 212, 136, 0.3)', borderRadius: 20, padding: '6px 14px', fontSize: 12 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D488', boxShadow: '0 0 8px #00D488' }} />
                    <span style={{ color: '#00D488', fontWeight: 700 }}>Live Updates</span>
                  </div>

                  <div style={{ background: isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.6)', border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)'}`, borderRadius: 20, padding: '6px 14px', fontSize: 12, color: isLight ? '#334155' : '#94a3b8', fontWeight: 600 }}>
                    Last updated: {lastUpdatedTime}
                  </div>

                  <button
                    type="button"
                    onClick={handleSearchBuses}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.8)',
                      border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.3)'}`,
                      color: isLight ? '#047857' : '#00D488',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                    title="Refresh Live Telemetry"
                  >
                    🔄
                  </button>
                </div>
              </div>

              {/* Search Inputs Card */}
              <div
                className="find-bus-search-bar"
                style={{
                  background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                  border: isLight ? '1.5px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isLight ? '0 4px 20px rgba(15, 23, 42, 0.06)' : 'none',
                  borderRadius: 18,
                  padding: '18px 20px',
                  position: 'relative',
                }}
              >
                {/* FROM Input */}
                <div ref={fromRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#1e293b' : '#cbd5e1', textTransform: 'uppercase', marginBottom: 6 }}>
                    From (Starting Stop)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: 10, padding: '0 14px' }}>
                    <input
                      type="text"
                      value={fromStop}
                      onFocus={() => setShowFromSuggestions(true)}
                      onChange={(e) => {
                        setFromStop(e.target.value);
                        setShowFromSuggestions(true);
                      }}
                      placeholder="Type starting stop..."
                      style={{ width: '100%', padding: '12px 0', background: 'transparent', border: 'none', color: isLight ? '#0f172a' : '#ffffff', fontSize: 14, fontWeight: 600, outline: 'none' }}
                    />
                    <span style={{ color: '#00D488', fontSize: 14 }}>📍</span>
                  </div>

                  {showFromSuggestions && (
                    <div
                      className="autocomplete-dropdown"
                      style={{
                        position: 'absolute',
                        top: '105%',
                        left: 0,
                        right: 0,
                        backgroundColor: isLight ? '#ffffff' : 'rgba(10, 18, 26, 0.98)',
                        backdropFilter: 'blur(20px)',
                        border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.3)'}`,
                        borderRadius: 12,
                        maxHeight: 220,
                        overflowY: 'auto',
                        zIndex: 2000,
                        boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                      }}
                    >
                      {fromSuggestions.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setFromStop(s.name);
                            setShowFromSuggestions(false);
                          }}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#00D488', fontSize: 13 }}>📍</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff' }}>{s.name}</span>
                            <span style={{ fontSize: 11, color: '#00D488', fontWeight: 600 }}>({s.nameOd})</span>
                          </div>
                          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{s.km} km</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TO Input */}
                <div ref={toRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#1e293b' : '#cbd5e1', textTransform: 'uppercase', marginBottom: 6 }}>
                    To (Destination)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: 10, padding: '0 14px' }}>
                    <input
                      type="text"
                      value={toStop}
                      onFocus={() => setShowToSuggestions(true)}
                      onChange={(e) => {
                        setToStop(e.target.value);
                        setShowToSuggestions(true);
                      }}
                      placeholder="Type destination..."
                      style={{ width: '100%', padding: '12px 0', background: 'transparent', border: 'none', color: isLight ? '#0f172a' : '#ffffff', fontSize: 14, fontWeight: 600, outline: 'none' }}
                    />
                    <span style={{ color: '#00D488', fontSize: 14 }}>📍</span>
                  </div>

                  {showToSuggestions && (
                    <div
                      className="autocomplete-dropdown"
                      style={{
                        position: 'absolute',
                        top: '105%',
                        left: 0,
                        right: 0,
                        backgroundColor: isLight ? '#ffffff' : 'rgba(10, 18, 26, 0.98)',
                        backdropFilter: 'blur(20px)',
                        border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.3)'}`,
                        borderRadius: 12,
                        maxHeight: 220,
                        overflowY: 'auto',
                        zIndex: 2000,
                        boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                      }}
                    >
                      {toSuggestions.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setToStop(s.name);
                            setShowToSuggestions(false);
                          }}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#00D488', fontSize: 13 }}>📍</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff' }}>{s.name}</span>
                            <span style={{ fontSize: 11, color: '#00D488', fontWeight: 600 }}>({s.nameOd})</span>
                          </div>
                          <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{s.km} km</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#1e293b' : '#cbd5e1', textTransform: 'uppercase', marginBottom: 6 }}>
                    Date of Journey
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: 10, padding: '0 14px' }}>
                    <input
                      type="text"
                      value={travelDate}
                      onChange={(e) => setTravelDate(e.target.value)}
                      style={{ width: '100%', padding: '12px 0', background: 'transparent', border: 'none', color: isLight ? '#0f172a' : '#ffffff', fontSize: 14, fontWeight: 600, outline: 'none' }}
                    />
                    <span style={{ color: '#64748b', fontSize: 14 }}>📅</span>
                  </div>
                </div>

                {/* Search Submit */}
                <button
                  type="button"
                  className="search-submit-btn"
                  onClick={handleSearchBuses}
                  disabled={isSearching}
                  style={{
                    height: 46,
                    padding: '0 20px',
                    background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    borderRadius: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(0, 184, 122, 0.35)',
                    border: 'none',
                  }}
                >
                  <span>🔍</span>
                  <span>{isSearching ? 'Searching…' : 'Search Buses'}</span>
                </button>
              </div>

              {/* ── 2-COLUMN MAIN WORKSPACE (LEFT: BUS LIST | RIGHT: LIVE MAP) ── */}
              {hasSearched ? (
                <div className="find-bus-workspace">
                  {/* ── LEFT COLUMN: BUS RESULT LIST ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: 2 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>
                          Available Buses ({sortedBuses.length})
                        </div>
                        <div style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                          Buses running on your selected route
                        </div>
                      </div>

                      {/* Sort By Dropdown */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: isLight ? '#475569' : '#94a3b8', fontWeight: 600 }}>Sort by:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          style={{
                            background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.8)',
                            border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)'}`,
                            color: isLight ? '#0f172a' : '#ffffff',
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="Arrival Time" style={{ background: isLight ? '#ffffff' : '#0a101a', color: isLight ? '#0f172a' : '#ffffff' }}>Arrival Time ⌵</option>
                          <option value="Fare" style={{ background: isLight ? '#ffffff' : '#0a101a', color: isLight ? '#0f172a' : '#ffffff' }}>Fare ⌵</option>
                          <option value="Speed" style={{ background: isLight ? '#ffffff' : '#0a101a', color: isLight ? '#0f172a' : '#ffffff' }}>Speed ⌵</option>
                        </select>
                      </div>
                    </div>

                    {sortedBuses.length === 0 ? (
                      <div
                        style={{
                          background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                          borderRadius: 16,
                          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                          padding: '36px 20px',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div style={{ fontSize: 32 }}>🚌</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>
                          No direct buses found for this search
                        </div>
                        <div style={{ fontSize: 13, color: isLight ? '#64748b' : '#94a3b8', maxWidth: 360 }}>
                          No scheduled buses found for this selection. Try selecting another stop.
                        </div>
                      </div>
                    ) : (
                      sortedBuses.map((bus) => {
                        const isFocused = bus.id === focusedBusId;

                        return (
                          <div
                            key={bus.id}
                            className="bus-result-card"
                            style={{
                              background: isLight
                                ? (isFocused ? '#ecfdf5' : '#ffffff')
                                : (isFocused ? 'rgba(10, 22, 20, 0.95)' : 'rgba(10, 16, 26, 0.85)'),
                              borderRadius: 16,
                              border: isLight
                                ? (isFocused ? '2px solid #059669' : '1px solid #e2e8f0')
                                : (isFocused ? '1.5px solid #00D488' : '1px solid rgba(255, 255, 255, 0.08)'),
                              padding: '16px 18px',
                              boxShadow: isLight
                                ? (isFocused ? '0 6px 20px rgba(5, 150, 105, 0.15)' : '0 2px 8px rgba(15, 23, 42, 0.04)')
                                : (isFocused ? '0 10px 25px rgba(0, 212, 136, 0.15)' : '0 4px 15px rgba(0,0,0,0.3)'),
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {/* Left: Icon & Bus Names */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  backgroundColor: bus.iconBg,
                                  color: bus.iconColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 20,
                                  flexShrink: 0,
                                }}
                              >
                                🚌
                              </div>

                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D488', display: 'inline-block' }} />
                                  <strong style={{ fontSize: 14, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>{bus.busName}</strong>
                                  <span style={{ background: isLight ? '#dcfce7' : 'rgba(0, 212, 136, 0.12)', border: `1px solid ${isLight ? '#86efac' : 'rgba(0, 212, 136, 0.25)'}`, color: isLight ? '#047857' : '#00D488', fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 4 }}>
                                    LIVE
                                  </span>
                                </div>

                                <div style={{ fontSize: 11, color: isLight ? '#334155' : '#94a3b8', marginTop: 3 }}>
                                  {fromStop} ➔ {toStop}
                                </div>
                                <div style={{ fontSize: 10, color: isLight ? '#64748b' : '#64748b', marginTop: 1 }}>
                                  {bus.via}
                                </div>
                              </div>
                            </div>

                            {/* Middle: Speed & Next Stop */}
                            <div style={{ fontSize: 11, color: isLight ? '#334155' : '#94a3b8', display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div>Speed: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{bus.speed} km/h</strong></div>
                              <div>Next Stop: <strong style={{ color: '#00D488' }}>{bus.nextStop}</strong></div>
                            </div>

                            {/* Right: Arriving in & Price & Track Button */}
                            <div className="bus-card-bottom-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 10, color: isLight ? '#475569' : '#64748b' }}>Arriving in <strong style={{ color: isLight ? '#0f172a' : '#fff', fontSize: 13 }}>{bus.arrivingIn}</strong></div>
                                <div style={{ fontSize: 17, fontWeight: 900, color: '#00D488' }}>
                                  ₹{bus.fare}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setFocusedBusId(bus.id);
                                  setSelectedTrackingBus(bus);
                                }}
                                style={{
                                  padding: '8px 16px',
                                  background: isLight
                                    ? (isFocused ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : '#eff6ff')
                                    : (isFocused ? 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)' : 'rgba(0, 212, 136, 0.12)'),
                                  color: isLight
                                    ? (isFocused ? '#ffffff' : '#1d4ed8')
                                    : (isFocused ? '#ffffff' : '#00D488'),
                                  border: isLight
                                    ? (isFocused ? 'none' : '1px solid #bfdbfe')
                                    : (isFocused ? 'none' : '1px solid rgba(0, 212, 136, 0.35)'),
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  boxShadow: isFocused ? '0 4px 14px rgba(0, 184, 122, 0.35)' : 'none',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span>📍</span>
                                <span>Track This Bus</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* ── RIGHT COLUMN: LIVE BUS TRACKING MAP CARD ── */}
                  <div
                    style={{
                      background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                      border: isLight ? '1.5px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 20,
                      overflow: 'hidden',
                      position: 'sticky',
                      top: 20,
                      boxShadow: isLight ? '0 4px 20px rgba(15, 23, 42, 0.08)' : '0 20px 40px rgba(0,0,0,0.6)',
                    }}
                  >
                    {/* Map Card Header */}
                    <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D488' }} />
                        <span style={{ fontSize: 14, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>Live Bus Tracking</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#00D488', fontWeight: 700 }}>
                        Focused: {focusedBus.busName}
                      </div>
                    </div>

                    {/* Map View with Sized Markers */}
                    {focusedBus.lat !== 0 || _userLocation ? (
                      <GoogleMapView
                        center={{
                          lat: focusedBus.lat !== 0 ? focusedBus.lat : _userLocation!.lat,
                          lng: focusedBus.lng !== 0 ? focusedBus.lng : _userLocation!.lng,
                        }}
                        zoom={12}
                        height={540}
                        markers={mapMarkers}
                        followMarkerId={focusedBus.id || undefined}
                      />
                    ) : (
                      <div
                        style={{
                          height: 540,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.6)',
                          color: isLight ? '#64748b' : '#94a3b8',
                          gap: 12,
                        }}
                      >
                        <span style={{ fontSize: 36 }}>📡</span>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Waiting for device GPS</span>
                        <span style={{ fontSize: 12, color: isLight ? '#94a3b8' : '#64748b' }}>Location not available</span>
                      </div>
                    )}

                    {/* Map Bottom Status Legend */}
                    <div style={{ padding: '12px 18px', background: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, fontSize: 11, fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D488' }} />
                        <span style={{ color: isLight ? '#334155' : '#cbd5e1' }}>Running</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                        <span style={{ color: isLight ? '#334155' : '#cbd5e1' }}>Slowed</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e11d48' }} />
                        <span style={{ color: isLight ? '#334155' : '#cbd5e1' }}>Stopped</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} />
                        <span style={{ color: '#64748b' }}>Offline</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Prompt before searching */
                <div
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                    borderRadius: 18,
                    border: isLight ? '1.5px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '40px 24px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div style={{ fontSize: 36 }}>🗺️</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                    Enter your destination or select a route above
                  </h3>
                  <p style={{ fontSize: 13, color: isLight ? '#64748b' : '#94a3b8', maxWidth: 460, margin: 0 }}>
                    Available buses and the real-time satellite tracking radar will appear based on your searched stops.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 }}>
                    {QUICK_ROUTE_CHIPS.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => handleQuickRouteSearch(c.from, c.to)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 20,
                          background: isLight ? '#f1f5f9' : 'rgba(0, 212, 136, 0.12)',
                          border: '1px solid rgba(0, 212, 136, 0.3)',
                          color: '#00D488',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════════
              ══ 3. MY TICKETS SCREEN (PROFESSIONAL INDIAN TRANSIT E-TICKET) ══
              ═════════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'TICKETS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680, width: '100%', margin: '0 auto' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  Digital Boarding Pass & E-Tickets
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#64748b' : '#94a3b8', marginTop: 4 }}>
                  Official valid electronic travel document. Present QR code to the on-duty conductor upon boarding.
                </p>
              </div>

              {tickets.map((tkt) => (
                <div
                  key={tkt.id}
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.95)',
                    borderRadius: 24,
                    border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.35)'}`,
                    overflow: 'hidden',
                    boxShadow: isLight ? '0 10px 30px rgba(15, 23, 42, 0.08)' : '0 25px 50px rgba(0,0,0,0.7)',
                  }}
                >
                  {/* Boarding Pass Header Banner */}
                  <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0, 212, 136, 0.3)' }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 900, color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        RURALBUS · RURAL TRANSIT NETWORK
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
                        PNR: {tkt.id}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: '#00D488', color: '#000', fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 9999 }}>
                        {tkt.status}
                      </span>
                    </div>
                  </div>

                  {/* Ticket Details Body */}
                  <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Origin & Destination Nodes */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isLight ? '1px dashed #cbd5e1' : '1px dashed rgba(255,255,255,0.15)', paddingBottom: 18 }}>
                      <div>
                        <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>ORIGIN / BOARDING</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{tkt.from}</div>
                        <div style={{ fontSize: 11, color: '#00D488', fontWeight: 600 }}>Highway Stop</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: isLight ? '#64748b' : '#64748b', fontWeight: 700 }}>DIRECT CORRIDOR</span>
                        <span style={{ fontSize: 18, color: '#00D488' }}>────────➔</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>DESTINATION</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{tkt.to}</div>
                        <div style={{ fontSize: 11, color: '#00D488', fontWeight: 600 }}>Main Transit Stand</div>
                      </div>
                    </div>

                    {/* Operational Metadata Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center' }}>
                      <div style={{ background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', padding: '10px 6px', borderRadius: 10, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 10, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 700 }}>TRAVEL DATE</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{tkt.date}</div>
                      </div>
                      <div style={{ background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', padding: '10px 6px', borderRadius: 10, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 10, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 700 }}>DEPARTURE</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{tkt.time}</div>
                      </div>
                      <div style={{ background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', padding: '10px 6px', borderRadius: 10, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 10, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 700 }}>SEAT NO.</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#00D488', marginTop: 1 }}>#{tkt.seat}</div>
                      </div>
                      <div style={{ background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', padding: '10px 6px', borderRadius: 10, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 10, color: isLight ? '#64748b' : '#94a3b8', fontWeight: 700 }}>VEHICLE REG</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{tkt.busReg}</div>
                      </div>
                    </div>

                    {/* Scannable High-Contrast QR Code Block */}
                    <div style={{ background: '#ffffff', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
                      <svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="10" y="10" width="36" height="36" stroke="#04080e" strokeWidth="6" rx="4" />
                        <rect x="20" y="20" width="16" height="16" fill="#04080e" />
                        <rect x="94" y="10" width="36" height="36" stroke="#04080e" strokeWidth="6" rx="4" />
                        <rect x="104" y="20" width="16" height="16" fill="#04080e" />
                        <rect x="10" y="94" width="36" height="36" stroke="#04080e" strokeWidth="6" rx="4" />
                        <rect x="20" y="104" width="16" height="16" fill="#04080e" />
                        <rect x="56" y="14" width="8" height="8" fill="#04080e" />
                        <rect x="72" y="14" width="8" height="8" fill="#04080e" />
                        <rect x="56" y="28" width="14" height="8" fill="#04080e" />
                        <rect x="76" y="28" width="8" height="14" fill="#04080e" />
                        <rect x="14" y="56" width="16" height="8" fill="#04080e" />
                        <rect x="36" y="56" width="8" height="16" fill="#04080e" />
                        <rect x="52" y="52" width="12" height="12" fill="#00875A" rx="2" />
                        <rect x="68" y="52" width="20" height="8" fill="#04080e" />
                        <rect x="96" y="56" width="14" height="14" fill="#04080e" />
                        <rect x="116" y="56" width="10" height="8" fill="#04080e" />
                        <rect x="52" y="72" width="18" height="10" fill="#04080e" />
                        <rect x="76" y="68" width="14" height="14" fill="#04080e" />
                        <rect x="98" y="76" width="12" height="12" fill="#04080e" />
                        <rect x="116" y="72" width="10" height="18" fill="#04080e" />
                        <rect x="56" y="94" width="14" height="8" fill="#04080e" />
                        <rect x="76" y="94" width="10" height="14" fill="#04080e" />
                        <rect x="94" y="96" width="18" height="8" fill="#04080e" />
                        <rect x="118" y="96" width="8" height="18" fill="#04080e" />
                        <rect x="56" y="112" width="24" height="14" fill="#04080e" />
                        <rect x="88" y="112" width="14" height="14" fill="#04080e" />
                        <rect x="110" y="120" width="16" height="6" fill="#04080e" />
                      </svg>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: '#04080e', letterSpacing: 0.5 }}>
                          {tkt.qrCode}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: 600 }}>
                          Scan via Handheld POS Device to validate boarding
                        </div>
                      </div>
                    </div>

                    {/* Fare & Security Notice */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: isLight ? '1px dashed #cbd5e1' : '1px dashed rgba(255,255,255,0.15)', paddingTop: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8' }}>PAYMENT STATUS</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#00D488' }}>PAID ONLINE · FARE ₹{tkt.fare}.00</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#64748b' }}>SECURITY HASH</div>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: isLight ? '#475569' : '#cbd5e1' }}>SHA256-VERIFIED</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const matchingBus = transitService.searchBuses(tkt.from, tkt.to, tkt.date)[0];
                        if (matchingBus) setSelectedTrackingBus(matchingBus);
                      }}
                      style={{
                        marginTop: 6,
                        padding: '12px 18px',
                        backgroundColor: 'rgba(0, 212, 136, 0.15)',
                        border: '1px solid rgba(0, 212, 136, 0.35)',
                        borderRadius: 12,
                        color: '#00D488',
                        fontSize: 13,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <span>📍</span>
                      <span>Track Live Bus on Stoppage Timeline & Map ➔</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════════
              ══ 4. PROFILE SCREEN ══
              ═════════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'PROFILE' && (
            <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20, width: '100%', margin: '0 auto' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  My Profile
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#64748b' : '#94a3b8', marginTop: 4 }}>
                  Your passenger account details
                </p>
              </div>

              <div
                style={{
                  background: isLight ? '#ffffff' : 'rgba(10, 18, 26, 0.85)',
                  borderRadius: 24,
                  border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.25)'}`,
                  padding: 24,
                  boxShadow: isLight ? '0 10px 30px rgba(15, 23, 42, 0.06)' : '0 15px 35px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 16 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#00593b', border: '1px solid #00D488', color: '#00D488', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                    RS
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>{user?.fullName || 'Rajesh Sharma'}</div>
                    <div style={{ fontSize: 12, color: '#00D488', fontWeight: 700, marginTop: 2 }}>VERIFIED PASSENGER</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: '12px 14px', background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8' }}>MOBILE NUMBER</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{user?.phone || '9876500001'}</div>
                  </div>

                  <div style={{ padding: '12px 14px', background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8' }}>EMAIL ADDRESS</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{user?.email || 'rajesh.sharma@example.com'}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logout}
                  style={{
                    marginTop: 8,
                    padding: '14px',
                    backgroundColor: isLight ? '#fee2e2' : 'rgba(225, 29, 72, 0.18)',
                    border: isLight ? '1px solid #fca5a5' : '1px solid rgba(225, 29, 72, 0.4)',
                    borderRadius: 12,
                    color: isLight ? '#b91c1c' : '#fca5a5',
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
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════════
              ══ MODALS & POPUPS ══
              ═════════════════════════════════════════════════════════════════════════ */}

          {/* 1. City / Region Selector Modal */}
          {showCityModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(10px)',
                zIndex: 3500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => setShowCityModal(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 440,
                  backgroundColor: isLight ? '#ffffff' : '#0a101a',
                  borderRadius: 20,
                  border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.35)'}`,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>
                    📍 Select Transit City / Region
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCityModal(false)}
                    style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#cbd5e1', fontSize: 18, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {AVAILABLE_CITIES.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: isLight ? '#64748b' : '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                      Location not available
                    </div>
                  ) : (
                    AVAILABLE_CITIES.map((city) => {
                      const isCurrent = city.name === selectedCity;
                      return (
                        <div
                          key={city.id}
                          onClick={() => {
                            setSelectedCity(city.name);
                            setFromStop(city.defaultFrom);
                            setToStop(city.defaultTo);
                            setShowCityModal(false);
                          }}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            backgroundColor: isCurrent
                              ? (isLight ? '#ecfdf5' : 'rgba(0, 212, 136, 0.15)')
                              : (isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)'),
                            border: isCurrent
                              ? '1.5px solid #00D488'
                              : `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>
                              {city.name} {city.nameOd ? <span style={{ color: '#00D488', fontSize: 12 }}>({city.nameOd})</span> : null}
                            </div>
                            <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                              {city.region} · e.g. {city.defaultFrom} ➔ {city.defaultTo}
                            </div>
                          </div>
                          {isCurrent && <span style={{ color: '#00D488', fontSize: 16 }}>✓</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. Quick Mobile Ticket Booking Modal */}
          {showBuyTicketModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(10px)',
                zIndex: 3500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => setShowBuyTicketModal(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 480,
                  backgroundColor: isLight ? '#ffffff' : '#0a101a',
                  borderRadius: 20,
                  border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.35)'}`,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>🎟️</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>Buy Mobile E-Ticket</div>
                      <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8' }}>Instant QR Boarding Pass</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBuyTicketModal(false)}
                    style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#cbd5e1', fontSize: 18, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#1e293b' : '#cbd5e1', textTransform: 'uppercase', marginBottom: 4 }}>
                      Boarding Stop
                    </label>
                    <select
                      value={bookingFrom}
                      onChange={(e) => setBookingFrom(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        backgroundColor: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.8)',
                        border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)'}`,
                        color: isLight ? '#0f172a' : '#ffffff',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {discoveryStops.length === 0 ? (
                        <option value="" disabled>No published trips currently available</option>
                      ) : (
                        discoveryStops.map((s) => (
                          <option key={s.id} value={s.name} style={{ background: isLight ? '#fff' : '#0a101a', color: isLight ? '#000' : '#fff' }}>
                            {s.name} ({s.nameOd}) - {s.km} km
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#1e293b' : '#cbd5e1', textTransform: 'uppercase', marginBottom: 4 }}>
                      Destination Stop
                    </label>
                    <select
                      value={bookingTo}
                      onChange={(e) => setBookingTo(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        backgroundColor: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.8)',
                        border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)'}`,
                        color: isLight ? '#0f172a' : '#ffffff',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {discoveryStops.length === 0 ? (
                        <option value="" disabled>No published trips currently available</option>
                      ) : (
                        discoveryStops.map((s) => (
                          <option key={s.id} value={s.name} style={{ background: isLight ? '#fff' : '#0a101a', color: isLight ? '#000' : '#fff' }}>
                            {s.name} ({s.nameOd}) - {s.km} km
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff' }}>Number of Passengers</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setBookingPassengers(Math.max(1, bookingPassengers - 1))}
                        style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: 15, fontWeight: 900 }}>{bookingPassengers}</span>
                      <button
                        type="button"
                        onClick={() => setBookingPassengers(Math.min(6, bookingPassengers + 1))}
                        style={{ width: 30, height: 30, borderRadius: 6, background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#1e293b' : '#cbd5e1', textTransform: 'uppercase', marginBottom: 4 }}>
                      Payment Method
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {(['UPI', 'WALLET', 'CARD'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setBookingPaymentMethod(m)}
                          style={{
                            padding: '8px',
                            borderRadius: 8,
                            backgroundColor: bookingPaymentMethod === m ? 'rgba(0, 212, 136, 0.15)' : (isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.6)'),
                            border: bookingPaymentMethod === m ? '1.5px solid #00D488' : `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.08)'}`,
                            color: bookingPaymentMethod === m ? '#00D488' : (isLight ? '#0f172a' : '#cbd5e1'),
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {m === 'UPI' ? '📱 UPI' : m === 'WALLET' ? '💳 Wallet' : '🏦 Card'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calculated Fare Summary */}
                  <div style={{ background: isLight ? '#ecfdf5' : 'rgba(0, 212, 136, 0.1)', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, color: isLight ? '#047857' : '#34d399', fontWeight: 700 }}>TOTAL AMOUNT</div>
                      <div style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8' }}>{bookingPassengers} Ticket(s) · Highway Corridor</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#00D488' }}>
                      ₹{transitService.calculateSegmentFare(bookingFrom, bookingTo).fare * bookingPassengers}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmBookTicket}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                    borderRadius: 12,
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 184, 122, 0.35)',
                  }}
                >
                  Confirm & Generate QR Boarding Pass ➔
                </button>
              </div>
            </div>
          )}

          {/* 3. All Stops Corridor Modal */}
          {showAllStopsModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(10px)',
                zIndex: 3500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => setShowAllStopsModal(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 480,
                  maxHeight: '80vh',
                  backgroundColor: isLight ? '#ffffff' : '#0a101a',
                  borderRadius: 20,
                  border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.35)'}`,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
                  overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>🚏 Active Transit Stoppages</div>
                    <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8' }}>Rural Highway Corridor Network</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllStopsModal(false)}
                    style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#cbd5e1', fontSize: 18, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
                  {discoveryStops.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: isLight ? '#64748b' : '#94a3b8', fontSize: 13 }}>
                      No active bus routes or published trips available.
                    </div>
                  ) : (
                    discoveryStops.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          backgroundColor: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)',
                          border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.06)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>
                            {s.name} <span style={{ color: '#00D488', fontSize: 11 }}>({s.nameOd})</span>
                          </div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>Code: {s.code} · Distance: {s.km} km</div>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setFromStop(s.name);
                              setShowAllStopsModal(false);
                            }}
                            style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(0, 212, 136, 0.15)', border: 'none', color: '#00D488', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
                          >
                            From
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setToStop(s.name);
                              setShowAllStopsModal(false);
                            }}
                            style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.15)', border: 'none', color: '#38bdf8', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
                          >
                            To
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. Daily Corridor Pass Modal */}
          {showPassModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(10px)',
                zIndex: 3500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => setShowPassModal(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 440,
                  backgroundColor: isLight ? '#ffffff' : '#0a101a',
                  borderRadius: 20,
                  border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.35)'}`,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 25px 50px rgba(0,0,0,0.8)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>⚡</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>Daily Corridor Pass</div>
                      <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8' }}>Unlimited Rural Bus Transit</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassModal(false)}
                    style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#cbd5e1', fontSize: 18, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ padding: 14, borderRadius: 12, border: '1.5px solid #00D488', background: 'rgba(0, 212, 136, 0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: isLight ? '#0f172a' : '#ffffff' }}>1-Day All-Corridor Pass</span>
                      <span style={{ fontWeight: 900, fontSize: 18, color: '#00D488' }}>₹99</span>
                    </div>
                    <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 4 }}>
                      Valid on all standard & express rural buses across the corridor for 24 hours from purchase.
                    </div>
                  </div>

                  <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`, background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: isLight ? '#0f172a' : '#ffffff' }}>Monthly Commuter Pass</span>
                      <span style={{ fontWeight: 900, fontSize: 18, color: isLight ? '#0f172a' : '#ffffff' }}>₹1,499</span>
                    </div>
                    <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', marginTop: 4 }}>
                      30 days unlimited transit for regular rural commuters. Save over 45% on daily trips.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPassModal(false);
                    setActiveTab('TICKETS');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                    borderRadius: 12,
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Activate 1-Day Pass (₹99) ➔
                </button>
              </div>
            </div>
          )}

          {/* 5. Live Bus Tracking Popup Modal */}
          {selectedTrackingBus && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(14px)',
                zIndex: 3000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                boxSizing: 'border-box',
              }}
              onClick={() => setSelectedTrackingBus(null)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 520,
                  maxHeight: '92vh',
                  backgroundColor: isLight ? '#ffffff' : '#0a101a',
                  borderRadius: 24,
                  border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.4)'}`,
                  boxShadow: isLight
                    ? '0 25px 60px rgba(15, 23, 42, 0.2), 0 4px 16px rgba(0, 0, 0, 0.06)'
                    : '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 40px rgba(0, 212, 136, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Top Bar */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.85)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff' }}>
                      {selectedTrackingBus.routeCode || 'Route 12'}
                    </div>
                    <span style={{ background: '#0284c7', color: '#ffffff', fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 4 }}>
                      {selectedTrackingBus.type?.includes('AC') ? 'AC' : 'EXP'}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>
                        To {selectedTrackingBus.to}
                      </div>
                      <div style={{ fontSize: 11, color: isLight ? '#475569' : '#94a3b8' }}>
                        {selectedTrackingBus.busName} ({selectedTrackingBus.busReg})
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedTrackingBus(null)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.1)',
                      border: isLight ? '1px solid #cbd5e1' : 'none',
                      color: isLight ? '#0f172a' : '#ffffff',
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Status Bar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isLight
                      ? (trackedFreshness === 'LIVE' ? '#ecfdf5' : trackedFreshness === 'STALE' ? '#fffbeb' : '#f8fafc')
                      : (trackedFreshness === 'LIVE' ? 'rgba(0, 212, 136, 0.12)' : trackedFreshness === 'STALE' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(15, 23, 42, 0.65)'),
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: `1px solid ${
                      trackedFreshness === 'LIVE' ? (isLight ? '#86efac' : 'rgba(0, 212, 136, 0.35)')
                      : trackedFreshness === 'STALE' ? (isLight ? '#fde68a' : 'rgba(245, 158, 11, 0.35)')
                      : (isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)')
                    }`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: trackedFreshness === 'LIVE' ? '#00D488' : trackedFreshness === 'STALE' ? '#f59e0b' : '#94a3b8',
                        display: 'inline-block',
                        boxShadow: trackedFreshness === 'LIVE' ? '0 0 8px #00D488' : 'none',
                      }} />
                      <span style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: trackedFreshness === 'LIVE' ? (isLight ? '#047857' : '#00D488') : trackedFreshness === 'STALE' ? '#f59e0b' : (isLight ? '#475569' : '#94a3b8'),
                      }}>
                        {trackedFreshness === 'LIVE' ? 'Live Device GPS Active'
                          : trackedFreshness === 'STALE' ? 'Signal Delayed (Stale GPS)'
                          : trackedFreshness === 'OFFLINE' ? 'Signal Lost (Offline)'
                          : 'No Active GPS Stream'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>
                      Speed: <span style={{ color: trackedFreshness === 'LIVE' ? (isLight ? '#047857' : '#00D488') : (isLight ? '#64748b' : '#94a3b8') }}>
                        {trackedLiveLocation ? `${trackedLiveLocation.speed} km/h` : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Route Stoppage Timeline */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 16 }}>
                      Route Stoppage Timeline
                    </div>

                    <div style={{ position: 'relative', paddingLeft: 28 }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: 8,
                          top: 6,
                          bottom: 6,
                          width: 3,
                          backgroundColor: isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)',
                          borderRadius: 2,
                        }}
                      />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                        {trackingTimelineStops.map((stop: any, idx: number) => {
                          const isCurrentStop = idx === 3 || stop.name.toLowerCase() === selectedTrackingBus.nextStop?.toLowerCase();
                          const isPassed = idx < 3;

                          return (
                            <div key={stop.name + idx} style={{ position: 'relative' }}>
                              <div
                                style={{
                                  position: 'absolute',
                                  left: -28,
                                  top: isCurrentStop ? -3 : 2,
                                  width: isCurrentStop ? 26 : 14,
                                  height: isCurrentStop ? 26 : 14,
                                  borderRadius: '50%',
                                  backgroundColor: isCurrentStop
                                    ? (isLight ? '#047857' : '#00D488')
                                    : isPassed
                                    ? (isLight ? '#dcfce7' : 'rgba(255,255,255,0.3)')
                                    : (isLight ? '#ffffff' : '#0a101a'),
                                  border: isCurrentStop
                                    ? '3px solid #ffffff'
                                    : `2px solid ${isLight ? (isPassed ? '#86efac' : '#cbd5e1') : 'rgba(255, 255, 255, 0.3)'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 12,
                                  color: '#fff',
                                  fontWeight: 900,
                                  boxShadow: isCurrentStop
                                    ? '0 0 16px rgba(0, 212, 136, 0.9)'
                                    : 'none',
                                  transform: isCurrentStop ? 'translateX(-6px)' : 'none',
                                  zIndex: 2,
                                }}
                              >
                                {isCurrentStop ? '🚌' : null}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <div
                                    style={{
                                      fontSize: isCurrentStop ? 15 : 13,
                                      fontWeight: isCurrentStop ? 900 : 700,
                                      color: isCurrentStop
                                        ? (isLight ? '#047857' : '#00D488')
                                        : isPassed
                                        ? (isLight ? '#475569' : '#94a3b8')
                                        : (isLight ? '#0f172a' : '#ffffff'),
                                    }}
                                  >
                                    {stop.name} <span style={{ fontSize: 11, opacity: 0.8 }}>({stop.nameOd})</span>
                                  </div>
                                  {isCurrentStop && (
                                    <div style={{ fontSize: 11, color: isLight ? '#047857' : '#34d399', fontWeight: 700, marginTop: 3 }}>
                                      📍 Live Bus Location · Arriving in {selectedTrackingBus.arrivingIn}
                                    </div>
                                  )}
                                </div>

                                <div style={{ fontSize: 11, color: isCurrentStop ? (isLight ? '#047857' : '#00D488') : (isLight ? '#475569' : '#64748b'), fontWeight: 700 }}>
                                  {stop.time}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Live GPS Radar Map */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isLight ? '#334155' : '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
                      Live GPS Radar Map
                    </div>

                    {!trackedLiveLocation && (
                      <div style={{
                        background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.65)',
                        border: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)'}`,
                        borderRadius: 14,
                        padding: '14px 18px',
                        marginBottom: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        color: isLight ? '#475569' : '#94a3b8',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        <span>🛰️</span>
                        <span>Waiting for real driver GPS transmission from active duty trip. No simulated coordinates used.</span>
                      </div>
                    )}

                    <div style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.35)'}`, height: 260, position: 'relative' }}>
                      {trackedLiveLocation || _userLocation ? (
                        <GoogleMapView
                          center={{
                            lat: trackedLiveLocation ? trackedLiveLocation.latitude : _userLocation!.lat,
                            lng: trackedLiveLocation ? trackedLiveLocation.longitude : _userLocation!.lng,
                          }}
                          zoom={trackedLiveLocation ? 15 : 12}
                          height={260}
                          markers={trackedLiveLocation ? [
                            {
                              id: selectedTrackingBus.id,
                              lat: trackedLiveLocation.latitude,
                              lng: trackedLiveLocation.longitude,
                              title: selectedTrackingBus.busName,
                              subtitle: `${selectedTrackingBus.busReg} · Speed ${trackedLiveLocation.speed} km/h`,
                              type: 'BUS',
                              speed: trackedLiveLocation.speed,
                              status: trackedFreshness === 'LIVE' ? 'RUNNING' : 'STOPPED',
                              nextStop: selectedTrackingBus.nextStop,
                            },
                          ] : []}
                        />
                      ) : (
                        <div
                          style={{
                            height: 260,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.6)',
                            color: isLight ? '#64748b' : '#94a3b8',
                            gap: 8,
                          }}
                        >
                          <span style={{ fontSize: 28 }}>📡</span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>Waiting for real driver GPS transmission</span>
                          <span style={{ fontSize: 11, color: isLight ? '#94a3b8' : '#64748b' }}>Location not available</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Bottom CTA */}
                <div
                  style={{
                    padding: '14px 20px',
                    borderTop: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                    background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.8)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: isLight ? '#475569' : '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Fare</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#00D488' }}>₹{selectedTrackingBus.fare}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedTrackingBus(null)}
                    style={{
                      padding: '10px 24px',
                      background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 800,
                      borderRadius: 10,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0, 184, 122, 0.3)',
                      border: 'none',
                    }}
                  >
                    Close Tracker
                  </button>
                </div>
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
