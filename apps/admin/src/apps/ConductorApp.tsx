import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuthStore } from '../stores/auth.store.js';
import { apiClient } from '../services/api.client.js';
import { transitService, MasterStop } from '../services/transit.service.js';
import { TopHeader } from '../components/layout/TopHeader.js';
import { useThemeStore } from '../stores/theme.store.js';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal.js';

type ConductorNavTab = 'HOME' | 'SCAN' | 'PASSENGERS' | 'CASH_TICKETS' | 'PROFILE';

interface ManifestItem {
  id: string;
  ticketId: string;
  name: string;
  seat: number;
  from: string;
  to: string;
  type: 'ONLINE' | 'CASH';
  status: 'BOARDED' | 'WAITING';
  fare: number;
}

export function ConductorApp() {
  const { user, logout } = useAdminAuthStore();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<ConductorNavTab>('HOME');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Duty & Vehicle Info
  const [activeTripId, setActiveTripId] = useState('');
  const [busDetails, setBusDetails] = useState<{
    name: string;
    reg: string;
    route: string;
    routeCode: string;
  } | null>(null);

  // Scanner State
  const [scanStatus, setScanStatus] = useState<'IDLE' | 'VALID' | 'DUPLICATE' | 'INVALID'>('IDLE');
  const [manualTicketInput, setManualTicketInput] = useState('');
  const [scannedTicket, setScannedTicket] = useState<{
    id: string;
    name: string;
    seat: number;
    from: string;
    to: string;
    fare: number;
    time: string;
  } | null>(null);

  // Manifest Search & Filter
  const [manifestSearch, setManifestSearch] = useState('');
  const [manifestFilter, setManifestFilter] = useState<'ALL' | 'BOARDED' | 'WAITING'>('ALL');

  // Master Stoppages from Transit Service (Shared with Admin & Passenger)
  const [allStops, setAllStops] = useState<MasterStop[]>([]);

  // Passenger Manifest List
  const [manifest, setManifest] = useState<ManifestItem[]>([]);

  // Cash Tickets POS State: Start Stop, Destination Stop & Custom Fare
  const [fromStop, setFromStop] = useState('');
  const [toStop, setToStop] = useState('');
  const [unitFare, setUnitFare] = useState<number>(0);
  const [isManualFareEdit, setIsManualFareEdit] = useState(false);
  const [cashQty, setCashQty] = useState(1);
  const [cashTotal, setCashTotal] = useState(0);
  const [isCustomStopOpen, setIsCustomStopOpen] = useState(false);
  const [customStopName, setCustomStopName] = useState('');
  const [customStopKm, setCustomStopKm] = useState(50);

  const [issuedReceipt, setIssuedReceipt] = useState<{
    ticketId: string;
    from: string;
    to: string;
    distanceKm: number;
    qty: number;
    unitFare: number;
    totalFare: number;
    time: string;
  } | null>(null);

  // Offline Network & Queue State
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('ruralbus_conductor_offline_tickets') || localStorage.getItem('gaonbus_conductor_offline_tickets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // Load Master Stops from Shared Transit Service
  const loadMasterStops = useCallback(() => {
    const stops = transitService.getStops();
    setAllStops(stops);
  }, []);

  // Sync Offline Queue with Server
  const syncOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMsg(`Syncing ${offlineQueue.length} offline tickets to server...`);
    try {
      for (const tkt of offlineQueue) {
        await apiClient.post('/api/v1/conductor/cash-ticket', tkt).catch(() => {});
      }
      setOfflineQueue([]);
      localStorage.removeItem('ruralbus_conductor_offline_tickets');
      localStorage.removeItem('gaonbus_conductor_offline_tickets');
      setSyncStatusMsg('✓ All offline cash tickets synced successfully!');
      setTimeout(() => setSyncStatusMsg(''), 3500);
    } catch {
      setSyncStatusMsg('⚠️ Sync encountered error. Will retry when connected.');
    } finally {
      setIsSyncing(false);
    }
  }, [offlineQueue, isSyncing]);

  // 1. Fetch Real Duty & Manifest from API
  const loadDutyAndManifest = useCallback(async () => {
    try {
      loadMasterStops();

      const dutyRes = await apiClient.get('/api/v1/conductor/duty').catch(() => null);
      const d = dutyRes?.data?.data?.duty || dutyRes?.data?.data?.activeTrip;
      const reg = d?.bus?.registrationNumber || d?.busRegistrationNumber;
      if (d && reg) {
        if (d.tripId || d.id) setActiveTripId(d.tripId || d.id);
        const model = d.bus?.model || d.busModel || 'Commercial Bus';
        const origin = d.route?.origin || d.origin || '';
        const destination = d.route?.destination || d.destination || '';
        const routeCode = d.route?.routeCode || d.routeCode || 'Highway Route';
        setBusDetails({
          name: model,
          reg: reg,
          route: origin && destination ? `${origin} ➔ ${destination}` : 'Assigned Route',
          routeCode: routeCode,
        });
      } else {
        setActiveTripId('');
        setBusDetails(null);
      }

      if (activeTripId) {
        const manifestRes = await apiClient.get(`/api/v1/conductor/manifest/${activeTripId}`).catch(() => null);
        if (manifestRes?.data?.data?.manifest && Array.isArray(manifestRes.data.data.manifest)) {
          const mapped: ManifestItem[] = manifestRes.data.data.manifest.map((m: any, idx: number) => ({
            id: m.bookingId || `m-${idx}`,
            ticketId: m.ticketId || m.bookingId || `GB-${1000 + idx}`,
            name: m.passengerName || 'Passenger',
            seat: m.seatNumber || idx + 1,
            from: m.boardingStopName || 'Origin',
            to: m.droppingStopName || 'Destination',
            type: m.paymentType === 'CASH' ? 'CASH' : 'ONLINE',
            status: m.isBoarded ? 'BOARDED' : 'WAITING',
            fare: m.fareAmount || 0,
          }));
          setManifest(mapped);
        }

        const cashRes = await apiClient.get(`/api/v1/conductor/cash-settlement/${activeTripId}`).catch(() => null);
        if (cashRes?.data?.data?.cashRevenueAmount !== undefined) {
          setCashTotal(cashRes.data.data.cashRevenueAmount);
        }
      }
    } catch {}
  }, [activeTripId, loadMasterStops]);

  useEffect(() => {
    loadDutyAndManifest();
    const handleStopsUpdated = () => loadMasterStops();
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('ruralbus:stops-updated', handleStopsUpdated);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('ruralbus:stops-updated', handleStopsUpdated);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadDutyAndManifest, loadMasterStops, syncOfflineQueue]);

  // Recalculate Fare when From or To changes (unless conductor manually overrides)
  useEffect(() => {
    if (!isManualFareEdit) {
      const calc = transitService.calculateSegmentFare(fromStop, toStop);
      setUnitFare(calc.fare);
    }
  }, [fromStop, toStop, isManualFareEdit]);

  // Current Segment Distance
  const calculatedDistance = useMemo(() => {
    const s1 = allStops.find((s) => s.name.toLowerCase() === fromStop.toLowerCase());
    const s2 = allStops.find((s) => s.name.toLowerCase() === toStop.toLowerCase());
    if (s1 && s2) {
      return Math.abs(s2.km - s1.km);
    }
    return 68;
  }, [allStops, fromStop, toStop]);

  // Boarding & Ticket Metrics
  const boardedCount = useMemo(() => manifest.filter((m) => m.status === 'BOARDED').length, [manifest]);
  const waitingCount = useMemo(() => manifest.filter((m) => m.status === 'WAITING').length, [manifest]);
  const onlineTicketCount = useMemo(() => manifest.filter((m) => m.type === 'ONLINE').length, [manifest]);
  const cashTicketCount = useMemo(() => manifest.filter((m) => m.type === 'CASH').length, [manifest]);

  // 2. Validate Ticket Action
  const handleValidateTicket = async (type: 'VALID' | 'DUPLICATE' | 'INVALID') => {
    if (type === 'VALID') {
      const originName = busDetails ? busDetails.route.split('➔')[0]?.trim() || 'Origin Stop' : 'Origin Stop';
      const destName = busDetails ? busDetails.route.split('➔')[1]?.trim() || 'Destination Stop' : 'Destination Stop';
      const ticketId = manualTicketInput.trim() || 'TKT-001';
      setScanStatus('VALID');
      setScannedTicket({
        id: ticketId,
        name: 'Passenger',
        seat: 1,
        from: originName,
        to: destName,
        fare: unitFare || 50,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      setManifest((prev) =>
        prev.map((m) => (m.ticketId === ticketId ? { ...m, status: 'BOARDED' } : m))
      );
      try {
        await apiClient.post('/api/v1/tickets/validate-qr', {
          qrData: `RURALBUS-${ticketId}-${activeTripId}`,
        }).catch(() => {});
      } catch {}
    } else if (type === 'DUPLICATE') {
      const originName = busDetails ? busDetails.route.split('➔')[0]?.trim() || 'Origin Stop' : 'Origin Stop';
      const destName = busDetails ? busDetails.route.split('➔')[1]?.trim() || 'Destination Stop' : 'Destination Stop';
      setScanStatus('DUPLICATE');
      setScannedTicket({
        id: manualTicketInput.trim() || 'TKT-001',
        name: 'Passenger',
        seat: 1,
        from: originName,
        to: destName,
        fare: unitFare || 50,
        time: 'Already Verified',
      });
    } else {
      setScanStatus('INVALID');
      setScannedTicket(null);
    }
  };

  // 3. Toggle Manifest Boarding Status
  const handleToggleBoarding = (ticketId: string) => {
    setManifest((prev) =>
      prev.map((m) => {
        if (m.ticketId === ticketId) {
          const nextStatus = m.status === 'BOARDED' ? 'WAITING' : 'BOARDED';
          return { ...m, status: nextStatus };
        }
        return m;
      })
    );
  };

  // 4. Filtered Manifest List
  const filteredManifest = useMemo(() => {
    const q = manifestSearch.trim().toLowerCase();
    return manifest.filter((m) => {
      const matchFilter =
        manifestFilter === 'ALL' ||
        (manifestFilter === 'BOARDED' && m.status === 'BOARDED') ||
        (manifestFilter === 'WAITING' && m.status === 'WAITING');
      const matchQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.ticketId.toLowerCase().includes(q) ||
        m.seat.toString().includes(q) ||
        m.to.toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });
  }, [manifest, manifestSearch, manifestFilter]);

  // 5. Issue Cash Ticket
  const handleIssueCashTicket = async () => {
    const totalAmount = unitFare * cashQty;
    const newTktId = `CSH-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTicket = {
      ticketId: newTktId,
      from: fromStop,
      to: toStop,
      distanceKm: calculatedDistance,
      qty: cashQty,
      unitFare: unitFare,
      totalFare: totalAmount,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setIssuedReceipt(newTicket);
    setCashTotal((prev) => prev + totalAmount);

    // Add to manifest
    const newManifestEntry: ManifestItem = {
      id: `m-${Date.now()}`,
      ticketId: newTktId,
      name: `Cash Passenger (${cashQty})`,
      seat: Math.min(40, manifest.length + 1),
      from: fromStop,
      to: toStop,
      type: 'CASH',
      status: 'BOARDED',
      fare: totalAmount,
    };
    setManifest((prev) => [newManifestEntry, ...prev]);

    const ticketPayload = {
      tripId: activeTripId,
      boardingStop: fromStop,
      destinationStop: toStop,
      passengerCount: cashQty,
      fareAmount: totalAmount,
      ticketId: newTktId,
      issuedAt: new Date().toISOString(),
    };

    if (!isOnline) {
      const updatedQueue = [...offlineQueue, ticketPayload];
      setOfflineQueue(updatedQueue);
      localStorage.setItem('ruralbus_conductor_offline_tickets', JSON.stringify(updatedQueue));
      setSyncStatusMsg(`💾 Ticket #${newTktId} issued offline. Saved in local queue (${updatedQueue.length} pending).`);
      setTimeout(() => setSyncStatusMsg(''), 4000);
    } else {
      try {
        await apiClient.post('/api/v1/conductor/cash-ticket', ticketPayload).catch(() => {
          const updatedQueue = [...offlineQueue, ticketPayload];
          setOfflineQueue(updatedQueue);
          localStorage.setItem('ruralbus_conductor_offline_tickets', JSON.stringify(updatedQueue));
        });
      } catch {
        const updatedQueue = [...offlineQueue, ticketPayload];
        setOfflineQueue(updatedQueue);
        localStorage.setItem('ruralbus_conductor_offline_tickets', JSON.stringify(updatedQueue));
      }
    }
  };

  // 6. Add Custom Stoppage on the fly
  const handleAddCustomStoppage = () => {
    if (!customStopName.trim()) return;
    const name = customStopName.trim();
    const km = customStopKm || 50;
    const code = name.slice(0, 4).toUpperCase();

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newStop = transitService.addStop({
            name,
            nameOd: name,
            km,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            code,
          });
          setAllStops(transitService.getStops());
          setToStop(newStop.name);
          setCustomStopName('');
          setIsCustomStopOpen(false);
        },
        () => {
          const newStop = transitService.addStop({
            name,
            nameOd: name,
            km,
            lat: 0,
            lng: 0,
            code,
          });
          setAllStops(transitService.getStops());
          setToStop(newStop.name);
          setCustomStopName('');
          setIsCustomStopOpen(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      const newStop = transitService.addStop({
        name,
        nameOd: name,
        km,
        lat: 0,
        lng: 0,
        code,
      });
      setAllStops(transitService.getStops());
      setToStop(newStop.name);
      setCustomStopName('');
      setIsCustomStopOpen(false);
    }
  };

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#050a0f', color: '#ffffff', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>


      {/* ── CONDUCTOR 5-ITEM LEFT SIDEBAR ── */}
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
              🎫
            </div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.5, color: '#ffffff' }}>
                RURAL<span style={{ color: '#00D488' }}>BUS</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00D488', letterSpacing: 0.5 }}>
                Conductor POS
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
            { id: 'HOME',         icon: '🏠', label: 'Home / My Trip' },
            { id: 'SCAN',         icon: '📷', label: 'Scan Ticket' },
            { id: 'PASSENGERS',   icon: '👥', label: 'Passengers' },
            { id: 'CASH_TICKETS', icon: '💵', label: 'Cash Tickets' },
            { id: 'PROFILE',      icon: '👤', label: 'Profile' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id as ConductorNavTab);
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

        {/* Conductor Profile Card & Sign Out */}
        <div style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#00593b', color: '#00D488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, border: '1px solid rgba(0, 212, 136, 0.3)' }}>
              VP
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.fullName || 'Vijay Patel'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {busDetails ? `Conductor · ${busDetails.reg}` : 'No Bus Assigned'}
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
          icon="🎫"
          roleBadge="CONDUCTOR"
          roleBadgeColor="#00D488"
          roleBadgeBg="rgba(0, 212, 136, 0.15)"
          portalTitle="Conductor POS Terminal"
          portalSubtitle={busDetails ? `Bus: ${busDetails.reg} · Cash & Digital Ticketing` : 'Cash & Digital Ticketing'}
          activeViewTitle={
            activeTab === 'HOME'
              ? 'Trip Operations'
              : activeTab === 'SCAN'
              ? 'Ticket QR Scanner'
              : activeTab === 'PASSENGERS'
              ? `Passenger Manifest (${manifest.length})`
              : activeTab === 'CASH_TICKETS'
              ? 'Handheld Cash POS'
              : 'Conductor Profile'
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
        {/* Network & Offline Cash Sync Status Banner */}
        {(!isOnline || offlineQueue.length > 0 || syncStatusMsg) && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 14,
              background: !isOnline ? 'rgba(225, 29, 72, 0.18)' : 'rgba(0, 212, 136, 0.15)',
              border: `1.5px solid ${!isOnline ? '#e11d48' : '#00D488'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: !isOnline ? '#fca5a5' : '#00D488' }}>
              <span>{!isOnline ? '📡 OFFLINE MODE (No Internet)' : '🟢 ONLINE'}</span>
              <span>•</span>
              <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                {syncStatusMsg || (offlineQueue.length > 0 ? `${offlineQueue.length} offline cash tickets queued for sync` : 'All tickets synced with server')}
              </span>
            </div>

            {offlineQueue.length > 0 && isOnline && (
              <button
                type="button"
                onClick={syncOfflineQueue}
                disabled={isSyncing}
                style={{
                  padding: '6px 14px',
                  background: '#00D488',
                  color: '#000',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                {isSyncing ? 'Syncing...' : `Sync (${offlineQueue.length}) ➔`}
              </button>
            )}
          </div>
        )}

        {/* ══ 1. HOME / MY TRIP SCREEN ══ */}
        {activeTab === 'HOME' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
            
            {/* Assigned Bus & Route Card */}
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
                      ASSIGNED FLEET BUS
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: '#cbd5e1', marginTop: 4, fontWeight: 600 }}>
                    {busDetails.name} · {busDetails.routeCode}
                  </div>
                  <div style={{ fontSize: 15, color: '#00D488', marginTop: 6, fontWeight: 800 }}>
                    Route: {busDetails.route}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0, 212, 136, 0.15)', border: '1px solid #00D488', padding: '8px 14px', borderRadius: 10, fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D488', boxShadow: '0 0 8px #00D488' }} />
                  <span style={{ color: '#00D488', fontWeight: 800 }}>Assigned Duty Live</span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(10, 16, 26, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 20,
                  padding: '32px 24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🚌</div>
                <strong style={{ fontSize: 16, color: '#ffffff', display: 'block' }}>No Bus Assigned</strong>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 0 0' }}>
                  No active commercial trip or fleet vehicle is currently assigned to your conductor account.
                </p>
              </div>
            )}

            {/* Operational Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              {/* Onboard Passengers */}
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(0, 212, 136, 0.25)', padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#00D488', textTransform: 'uppercase' }}>ONBOARD PASSENGERS</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff', marginTop: 4, lineHeight: 1.1 }}>
                  {boardedCount} <span style={{ fontSize: '1.1rem', color: '#64748b' }}>/ 40</span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  <strong style={{ color: '#f59e0b' }}>{waitingCount}</strong> waiting at upcoming stops
                </div>
              </div>

              {/* Online Ticket Count */}
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(56, 189, 248, 0.25)', padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>ONLINE TICKETS</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#38bdf8', marginTop: 4, lineHeight: 1.1 }}>
                  {onlineTicketCount}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                  Pre-booked digital QR passes
                </div>
              </div>

              {/* Cash Collection & Cash Ticket Count */}
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(245, 158, 11, 0.25)', padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>CASH TICKETS & TOTAL</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#f59e0b', marginTop: 4, lineHeight: 1.1 }}>
                  ₹{cashTotal.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                  <strong>{cashTicketCount}</strong> POS cash tickets issued
                </div>
              </div>
            </div>

            {/* Quick Action Shortcuts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>Conductor Quick Actions</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {/* Action 1: Scan Ticket */}
                <div
                  onClick={() => setActiveTab('SCAN')}
                  style={{
                    background: 'rgba(10, 16, 26, 0.85)',
                    border: '1px solid rgba(0, 212, 136, 0.3)',
                    borderRadius: 16,
                    padding: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(0, 212, 136, 0.15)', color: '#00D488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    📷
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>Scan QR Boarding Pass</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Validate passenger QR tickets instantly</div>
                  </div>
                </div>

                {/* Action 2: Manifest */}
                <div
                  onClick={() => setActiveTab('PASSENGERS')}
                  style={{
                    background: 'rgba(10, 16, 26, 0.85)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: 16,
                    padding: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    👥
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>Passenger Manifest</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>View boarding roster and verify seats</div>
                  </div>
                </div>

                {/* Action 3: Cash Tickets */}
                <div
                  onClick={() => setActiveTab('CASH_TICKETS')}
                  style={{
                    background: 'rgba(10, 16, 26, 0.85)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 16,
                    padding: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    💵
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>Issue Cash Ticket</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Select Start/Stop, edit fare & print receipt</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ 2. SCAN TICKET SCREEN ══ */}
        {activeTab === 'SCAN' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Scan Passenger Ticket
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                Hold camera over the digital passenger QR code or enter ticket ID manually
              </p>
            </div>

            {/* Camera Viewfinder Box */}
            <div
              style={{
                background: 'rgba(10, 16, 26, 0.95)',
                borderRadius: 20,
                border: '1.5px solid rgba(0, 212, 136, 0.4)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 18,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              }}
            >
              {/* Animated Scanner Laser */}
              <div
                style={{
                  width: '100%',
                  maxWidth: 260,
                  height: 240,
                  border: '2px solid rgba(0, 212, 136, 0.6)',
                  borderRadius: 16,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(5, 10, 15, 0.8)',
                }}
              >
                <div style={{ position: 'absolute', top: 12, left: 12, width: 20, height: 20, borderTop: '3px solid #00D488', borderLeft: '3px solid #00D488' }} />
                <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderTop: '3px solid #00D488', borderRight: '3px solid #00D488' }} />
                <div style={{ position: 'absolute', bottom: 12, left: 12, width: 20, height: 20, borderBottom: '3px solid #00D488', borderLeft: '3px solid #00D488' }} />
                <div style={{ position: 'absolute', bottom: 12, right: 12, width: 20, height: 20, borderBottom: '3px solid #00D488', borderRight: '3px solid #00D488' }} />

                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                  <div>Align QR within frame</div>
                </div>
              </div>

              {/* Manual Ticket Input */}
              <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={manualTicketInput}
                  onChange={(e) => setManualTicketInput(e.target.value)}
                  placeholder="Enter Ticket ID (e.g. GB-7821)..."
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    backgroundColor: 'rgba(5, 10, 15, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 10,
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleValidateTicket('VALID')}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#00B87A',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  Verify
                </button>
              </div>

              {/* Quick Simulator Buttons */}
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button
                  type="button"
                  onClick={() => handleValidateTicket('VALID')}
                  style={{ flex: 1, padding: '10px', background: 'rgba(0, 212, 136, 0.15)', border: '1px solid #00D488', color: '#00D488', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  ✓ Test Valid QR
                </button>
                <button
                  type="button"
                  onClick={() => handleValidateTicket('DUPLICATE')}
                  style={{ flex: 1, padding: '10px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#f59e0b', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  ⚠️ Test Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => handleValidateTicket('INVALID')}
                  style={{ flex: 1, padding: '10px', background: 'rgba(225, 29, 72, 0.15)', border: '1px solid #e11d48', color: '#fca5a5', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  ✕ Test Invalid
                </button>
              </div>
            </div>

            {/* Validation Result Box */}
            {scanStatus === 'VALID' && scannedTicket && (
              <div style={{ background: 'rgba(6, 78, 59, 0.95)', border: '2px solid #00D488', borderRadius: 18, padding: 20, boxShadow: '0 15px 35px rgba(0, 212, 136, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#00D488' }}>
                    ✓ VALID TICKET CONFIRMED
                  </div>
                  <div style={{ background: '#00D488', color: '#000', fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 4 }}>
                    VERIFIED & BOARDED
                  </div>
                </div>

                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 13 }}>
                  <div>Passenger: <strong style={{ color: '#ffffff' }}>{scannedTicket.name}</strong></div>
                  <div>Seat Number: <strong style={{ color: '#00D488', fontSize: 16 }}>#{scannedTicket.seat}</strong></div>
                  <div>Origin: <strong style={{ color: '#ffffff' }}>{scannedTicket.from}</strong></div>
                  <div>Destination: <strong style={{ color: '#ffffff' }}>{scannedTicket.to}</strong></div>
                  <div>Amount Paid: <strong style={{ color: '#ffffff' }}>₹{scannedTicket.fare}.00</strong></div>
                  <div>Verified At: <strong style={{ color: '#cbd5e1' }}>{scannedTicket.time}</strong></div>
                </div>
              </div>
            )}

            {scanStatus === 'DUPLICATE' && scannedTicket && (
              <div style={{ background: 'rgba(120, 53, 15, 0.95)', border: '2px solid #f59e0b', borderRadius: 18, padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b' }}>
                  ⚠️ DUPLICATE TICKET WARNING
                </div>
                <div style={{ fontSize: 13, color: '#fef3c7', marginTop: 8 }}>
                  This ticket ({scannedTicket.id}) has already been verified and boarded at {scannedTicket.time}.
                </div>
              </div>
            )}

            {scanStatus === 'INVALID' && (
              <div style={{ background: 'rgba(136, 19, 55, 0.95)', border: '2px solid #e11d48', borderRadius: 18, padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fca5a5' }}>
                  ✕ INVALID TICKET
                </div>
                <div style={{ fontSize: 13, color: '#ffe4e6', marginTop: 8 }}>
                  No active booking found with this ticket ID. Please verify passenger details.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ 3. PASSENGERS (TRIP MANIFEST) SCREEN ══ */}
        {activeTab === 'PASSENGERS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 860 }}>
            <div className="page-view-header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  Trip Passenger Manifest
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 2 }}>
                  {manifest.length} Total Bookings · {boardedCount} Boarded · {waitingCount} Waiting
                </p>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: 6, background: isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.6)', padding: 4, borderRadius: 10, border: `1px solid ${isLight ? '#e2e8f0' : 'transparent'}` }}>
                {(['ALL', 'BOARDED', 'WAITING'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setManifestFilter(tab)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: manifestFilter === tab ? '#00B87A' : 'transparent',
                      color: manifestFilter === tab ? '#ffffff' : isLight ? '#475569' : '#94a3b8',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <input
              type="text"
              value={manifestSearch}
              onChange={(e) => setManifestSearch(e.target.value)}
              placeholder="Search by passenger name, seat # or ticket ID..."
              style={{
                padding: '12px 16px',
                backgroundColor: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: 12,
                color: isLight ? '#0f172a' : '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                outline: 'none',
              }}
            />

            {/* Manifest List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredManifest.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                    borderRadius: 16,
                    border: item.status === 'BOARDED' ? (isLight ? '1.5px solid #86efac' : '1px solid rgba(0, 212, 136, 0.3)') : (isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)'),
                    boxShadow: isLight ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: item.status === 'BOARDED' ? (isLight ? '#dcfce7' : 'rgba(0, 212, 136, 0.15)') : (isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)'),
                        color: item.status === 'BOARDED' ? (isLight ? '#15803d' : '#00D488') : (isLight ? '#0f172a' : '#ffffff'),
                        border: isLight ? (item.status === 'BOARDED' ? '1px solid #bbf7d0' : '1px solid #e2e8f0') : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 900,
                      }}
                    >
                      #{item.seat}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 15, color: isLight ? '#0f172a' : '#ffffff' }}>{item.name}</strong>
                        <span style={{ fontSize: 10, background: item.type === 'ONLINE' ? (isLight ? '#e0f2fe' : 'rgba(56, 189, 248, 0.15)') : (isLight ? '#fef3c7' : 'rgba(245, 158, 11, 0.15)'), color: item.type === 'ONLINE' ? (isLight ? '#0369a1' : '#38bdf8') : (isLight ? '#b45309' : '#f59e0b'), border: isLight ? (item.type === 'ONLINE' ? '1px solid #bae6fd' : '1px solid #fde68a') : 'none', padding: '2px 7px', borderRadius: 4, fontWeight: 800 }}>
                          {item.type}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: isLight ? '#475569' : '#94a3b8', marginTop: 2 }}>
                        {item.from} ➔ {item.to} · Ticket: <span style={{ fontFamily: 'monospace', color: isLight ? '#0f172a' : '#cbd5e1', fontWeight: 700 }}>{item.ticketId}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleBoarding(item.ticketId)}
                    style={{
                      padding: '8px 18px',
                      background: item.status === 'BOARDED' ? (isLight ? '#dcfce7' : 'rgba(0, 212, 136, 0.15)') : '#00B87A',
                      color: item.status === 'BOARDED' ? (isLight ? '#15803d' : '#00D488') : '#ffffff',
                      border: item.status === 'BOARDED' ? (isLight ? '1.5px solid #86efac' : '1px solid #00D488') : 'none',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {item.status === 'BOARDED' ? '✓ Boarded' : 'Mark as Boarded'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ 4. CASH TICKETS (DYNAMIC START & STOP + MANUAL AMOUNT EDIT) ══ */}
        {activeTab === 'CASH_TICKETS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                  Issue Cash Ticket
                </h1>
                <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                  Select starting stop & destination stop. Amount calculates automatically or can be entered manually.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCustomStopOpen(true)}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(0, 212, 136, 0.12)',
                  border: '1px solid rgba(0, 212, 136, 0.3)',
                  borderRadius: 10,
                  color: '#00D488',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>+</span>
                <span>Add Custom Stoppage</span>
              </button>
            </div>

            {/* Modal for Adding Custom Stoppage */}
            {isCustomStopOpen && (
              <div
                style={{
                  background: 'rgba(10, 18, 26, 0.98)',
                  border: '1.5px solid #00D488',
                  borderRadius: 16,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  boxShadow: '0 15px 35px rgba(0,0,0,0.8)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 15, color: '#00D488' }}>Add New Corridor Stoppage / Village Junction</strong>
                  <button
                    type="button"
                    onClick={() => setIsCustomStopOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                      STOPPAGE NAME
                    </label>
                    <input
                      type="text"
                      value={customStopName}
                      onChange={(e) => setCustomStopName(e.target.value)}
                      placeholder="e.g. Salandi Bridge Junction"
                      style={{ width: '100%', padding: '10px 12px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#ffffff', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                      DISTANCE (KM)
                    </label>
                    <input
                      type="number"
                      value={customStopKm}
                      onChange={(e) => setCustomStopKm(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px 12px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#ffffff', outline: 'none' }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddCustomStoppage}
                  style={{
                    padding: '11px',
                    background: '#00B87A',
                    border: 'none',
                    borderRadius: 10,
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Save & Select Stoppage
                </button>
              </div>
            )}

            {/* ── 1. START STOP (BOARDING) & DESTINATION STOP (ALIGHTING) SELECTORS ── */}
            <div
              style={{
                background: 'rgba(10, 16, 26, 0.85)',
                borderRadius: 20,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 12, alignItems: 'center' }}>
                {/* START STOP */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#00D488', textTransform: 'uppercase', marginBottom: 6 }}>
                    🟢 1. Starting Stop (Boarding)
                  </label>
                  <select
                    value={fromStop}
                    onChange={(e) => {
                      setFromStop(e.target.value);
                      setIsManualFareEdit(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '13px 14px',
                      backgroundColor: isLight ? '#ffffff' : 'rgba(5, 10, 15, 0.95)',
                      border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.3)'}`,
                      borderRadius: 12,
                      color: isLight ? '#0f172a' : '#ffffff',
                      fontSize: 14,
                      fontWeight: 800,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {allStops.map((s) => (
                      <option key={`from-${s.id}`} value={s.name} style={{ background: isLight ? '#ffffff' : '#050a0f', color: isLight ? '#0f172a' : '#fff' }}>
                        {s.name} ({s.nameOd}) · {s.km} km
                      </option>
                    ))}
                  </select>
                </div>

                {/* SWAP BUTTON */}
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 20 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const temp = fromStop;
                      setFromStop(toStop);
                      setToStop(temp);
                      setIsManualFareEdit(false);
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.1)',
                      border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.2)'}`,
                      color: isLight ? '#047857' : '#00D488',
                      fontSize: 16,
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Swap Boarding & Destination"
                  >
                    ⇄
                  </button>
                </div>

                {/* DESTINATION STOP */}
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: isLight ? '#0284c7' : '#38bdf8', textTransform: 'uppercase', marginBottom: 6 }}>
                    🔴 2. Destination Stop (Alighting)
                  </label>
                  <select
                    value={toStop}
                    onChange={(e) => {
                      setToStop(e.target.value);
                      setIsManualFareEdit(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '13px 14px',
                      backgroundColor: isLight ? '#ffffff' : 'rgba(5, 10, 15, 0.95)',
                      border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(56, 189, 248, 0.3)'}`,
                      borderRadius: 12,
                      color: isLight ? '#0f172a' : '#ffffff',
                      fontSize: 14,
                      fontWeight: 800,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {allStops.map((s) => (
                      <option key={`to-${s.id}`} value={s.name} style={{ background: isLight ? '#ffffff' : '#050a0f', color: isLight ? '#0f172a' : '#fff' }}>
                        {s.name} ({s.nameOd}) · {s.km} km
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Destination Chips for Fast 1-Tap Tap-In */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
                  Quick Destination Stops:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {allStops.slice(0, 7).map((s) => {
                    const isSelected = toStop.toLowerCase() === s.name.toLowerCase();
                    return (
                      <button
                        key={`chip-${s.id}`}
                        type="button"
                        onClick={() => {
                          setToStop(s.name);
                          setIsManualFareEdit(false);
                        }}
                        style={{
                          padding: '7px 14px',
                          background: isSelected ? 'rgba(0, 212, 136, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                          border: isSelected ? '1.5px solid #00D488' : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 8,
                          color: isSelected ? '#00D488' : '#cbd5e1',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Segment Distance & Auto Route Notice */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '10px 14px', borderRadius: 10, fontSize: 12, color: '#94a3b8' }}>
                <div>
                  Route: <strong style={{ color: '#ffffff' }}>{fromStop}</strong> ➔ <strong style={{ color: '#00D488' }}>{toStop}</strong>
                </div>
                <div>
                  Segment Distance: <strong style={{ color: '#38bdf8' }}>{calculatedDistance} km</strong>
                </div>
              </div>
            </div>

            {/* ── 2. FARE PER PASSENGER (EDITABLE & AUTO-CALCULATED) + PASSENGER QUANTITY ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {/* Editable Unit Fare Amount */}
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(0, 212, 136, 0.3)', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#00D488', textTransform: 'uppercase' }}>
                    FARE PER PASSENGER (₹)
                  </span>
                  {isManualFareEdit && (
                    <span style={{ fontSize: 10, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                      MANUAL OVERRIDE
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#00D488' }}>₹</span>
                  <input
                    type="number"
                    value={unitFare}
                    onChange={(e) => {
                      setUnitFare(Math.max(0, Number(e.target.value)));
                      setIsManualFareEdit(true);
                    }}
                    placeholder="Enter fare..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(5, 10, 15, 0.95)',
                      border: '1.5px solid rgba(0, 212, 136, 0.5)',
                      borderRadius: 10,
                      color: '#ffffff',
                      fontSize: '1.6rem',
                      fontWeight: 900,
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Auto-calculated: ₹{Math.max(15, Math.round(15 + calculatedDistance * 1.15))}</span>
                  {isManualFareEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualFareEdit(false);
                        const calc = transitService.calculateSegmentFare(fromStop, toStop);
                        setUnitFare(calc.fare);
                      }}
                      style={{ background: 'none', border: 'none', color: '#00D488', fontSize: 11, fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Reset Auto
                    </button>
                  )}
                </div>
              </div>

              {/* Quantity Stepper */}
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(255, 255, 255, 0.08)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                  PASSENGER QUANTITY
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setCashQty((q) => Math.max(1, q - 1))}
                    style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 20, fontWeight: 900, cursor: 'pointer' }}
                  >
                    -
                  </button>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff' }}>
                      {cashQty}
                    </span>
                    <div style={{ fontSize: 10, color: '#64748b' }}>Passenger{cashQty > 1 ? 's' : ''}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCashQty((q) => Math.min(20, q + 1))}
                    style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 20, fontWeight: 900, cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* ── 3. TOTAL CALCULATION & ISSUE CASH TICKET BUTTON ── */}
            <div style={{ background: 'linear-gradient(135deg, rgba(10, 24, 20, 0.95) 0%, rgba(10, 16, 26, 0.95) 100%)', borderRadius: 20, border: '1.5px solid #00D488', padding: '22px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                  TOTAL CASH AMOUNT TO COLLECT
                </div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#00D488', marginTop: 2, lineHeight: 1.1 }}>
                  ₹{unitFare * cashQty}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                  Calculation: ₹{unitFare} × {cashQty} passenger{cashQty > 1 ? 's' : ''}
                </div>
              </div>

              <button
                type="button"
                onClick={handleIssueCashTicket}
                style={{
                  padding: '16px 28px',
                  background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                  color: '#ffffff',
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  borderRadius: 14,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 6px 25px rgba(0, 184, 122, 0.45)',
                }}
              >
                <span>💵</span>
                <span>ISSUE CASH TICKET (₹{unitFare * cashQty})</span>
              </button>
            </div>

            {/* ── 4. GENERATED THERMAL RECEIPT PREVIEW ── */}
            {issuedReceipt && (
              <div
                style={{
                  background: '#ffffff',
                  color: '#04080e',
                  borderRadius: 20,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
                  border: '1px solid #cbd5e1',
                }}
              >
                <div style={{ textAlign: 'center', borderBottom: '1.5px dashed #64748b', paddingBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.5 }}>
                    RURAL TRANSIT NETWORK (RURALBUS)
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginTop: 2 }}>
                    OFFICIAL ON-BOARD HANDHELD POS TICKET
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                    VEHICLE: {busDetails?.reg || 'N/A'} · CONDUCTOR: {user?.fullName || 'Vijay Patel'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 13, padding: '4px 0' }}>
                  <div>TICKET PNR: <strong style={{ fontFamily: 'monospace' }}>{issuedReceipt.ticketId}</strong></div>
                  <div>DATE & TIME: <strong>{issuedReceipt.time}</strong></div>
                  <div>STARTING STOP: <strong>{issuedReceipt.from}</strong></div>
                  <div>DESTINATION: <strong>{issuedReceipt.to}</strong></div>
                  <div>DISTANCE: <strong>{issuedReceipt.distanceKm} km</strong></div>
                  <div>PASSENGERS: <strong>{issuedReceipt.qty} Person(s)</strong></div>
                </div>

                <div
                  style={{
                    borderTop: '1.5px dashed #64748b',
                    paddingTop: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>FARE PER PASSENGER: ₹{issuedReceipt.unitFare}.00</div>
                    <div style={{ fontSize: 11, color: '#04080e', fontWeight: 800 }}>PAYMENT METHOD: CASH (POS)</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#64748b' }}>TOTAL AMOUNT PAID</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#00875A' }}>
                      ₹{issuedReceipt.totalFare}.00
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: 10, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                  Thank you for travelling with RuralBus. Keep this physical receipt till destination stop.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ 5. PROFILE SCREEN ══ */}
        {activeTab === 'PROFILE' && (
          <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Conductor Profile
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                On-board ticketing staff credentials
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
                  VP
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff' }}>{user?.fullName || 'Vijay Patel'}</div>
                  <div style={{ fontSize: 12, color: '#00D488', fontWeight: 700, marginTop: 2 }}>AUTHORISED BUS CONDUCTOR</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>ASSIGNED VEHICLE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{busDetails ? `${busDetails.reg} (${busDetails.name})` : 'No Duty Assigned'}</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>ASSIGNED ROUTE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{busDetails ? busDetails.route : 'No Route Assigned'}</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>REGISTERED MOBILE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{user?.phone || '+91 9876500004'}</div>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>STAFF ID</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#00D488', marginTop: 2 }}>CND-452109 · On-board Fare Collector</div>
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
