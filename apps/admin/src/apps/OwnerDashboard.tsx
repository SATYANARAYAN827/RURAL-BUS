import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuthStore } from '../stores/auth.store.js';
import { GoogleMapView, MapMarker } from '../components/maps/GoogleMapView.js';
import { transitService, MasterStop } from '../services/transit.service.js';
import {
  operatorStore,
  FleetBus,
  FleetStaff,
  BusRequest,
} from '../services/operatorStore.service.js';
import { TopHeader } from '../components/layout/TopHeader.js';
import { useThemeStore } from '../stores/theme.store.js';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal.js';

type OwnerNavTab = 'HOME' | 'BUSES' | 'LIVE_MAP' | 'STAFF' | 'ROUTES' | 'TRIPS' | 'REVENUE' | 'PROFILE';

interface RevenueSummary {
  onlineRevenue: number;
  onlineTicketCount: number;
  cashRevenue: number;
  cashTicketCount: number;
  totalRevenue: number;
  totalPassengers: number;
}

export function OwnerDashboard() {
  const { user, tenant, logout } = useAdminAuthStore();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<OwnerNavTab>('HOME');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Tenant ID for current Owner
  const currentTenantId = tenant?.id || 'a54b0153-8246-4f88-bba9-7ef85b51a6ed';
  const currentTenantName = tenant?.name || 'Kaveri Express Rural Transport';

  // Owner Fleet Data (Scoped to this tenant only)
  const [buses, setBuses] = useState<FleetBus[]>([]);
  const [staff, setStaff] = useState<FleetStaff[]>([]);
  const [myRequests, setMyRequests] = useState<BusRequest[]>([]);
  const [stops, setStops] = useState<MasterStop[]>([]);

  // Revenue Breakdown for this Owner
  const [revenue] = useState<RevenueSummary>({
    onlineRevenue: 32750,
    onlineTicketCount: 62,
    cashRevenue: 14450,
    cashTicketCount: 413,
    totalRevenue: 47200,
    totalPassengers: 475,
  });

  // Modal: Request New Bus from Super Admin
  const [isRequestBusOpen, setIsRequestBusOpen] = useState(false);
  const [requestedModel, setRequestedModel] = useState('Tata Starbus Ultra 44-Seater AC');
  const [requestedCapacity, setRequestedCapacity] = useState(44);
  const [requestedRoute, setRequestedRoute] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestSuccessMessage, setRequestSuccessMessage] = useState('');

  // Modal: Add Staff (Driver / Conductor)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Driver' | 'Conductor'>('Driver');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffBus, setNewStaffBus] = useState('');
  const [newStaffLicense, setNewStaffLicense] = useState('');

  // Modal: Stoppage Management (Add, Edit, Delete Stoppage)
  const [selectedBusForStoppages, setSelectedBusForStoppages] = useState<FleetBus | null>(null);
  const [isAddStoppageModalOpen, setIsAddStoppageModalOpen] = useState(false);
  const [editingStoppage, setEditingStoppage] = useState<MasterStop | null>(null);
  const [stoppageName, setStoppageName] = useState('');
  const [stoppageNameOd, setStoppageNameOd] = useState('');
  const [stoppageKm, setStoppageKm] = useState<number>(50);
  const [stoppageCode, setStoppageCode] = useState('');
  const [stoppageSuccessMsg, setStoppageSuccessMsg] = useState('');

  // Refresh Owner Data
  const refreshOwnerData = useCallback(async () => {
    setBuses(operatorStore.getBuses(currentTenantId));
    setStaff(operatorStore.getStaff(currentTenantId));
    setMyRequests(operatorStore.getRequests(currentTenantId));
    setStops(transitService.getStops());

    try {
      await Promise.all([
        operatorStore.syncWithBackend(currentTenantId),
        transitService.syncWithBackend(),
      ]);
      setBuses(operatorStore.getBuses(currentTenantId));
      setStops(transitService.getStops());
    } catch (err) {
      console.warn('Backend sync failed in OwnerDashboard:', err);
    }
  }, [currentTenantId]);

  useEffect(() => {
    refreshOwnerData();
    const handleEvents = () => refreshOwnerData();
    window.addEventListener('ruralbus:stops-updated', handleEvents);
    window.addEventListener('ruralbus:buses-updated', handleEvents);
    return () => {
      window.removeEventListener('ruralbus:stops-updated', handleEvents);
      window.removeEventListener('ruralbus:buses-updated', handleEvents);
    };
  }, [refreshOwnerData]);

  // Handle Request New Bus Submission
  const handleSendBusRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedModel || !requestedRoute || !requestReason) return;

    operatorStore.requestNewBus({
      tenantId: currentTenantId,
      tenantName: currentTenantName,
      ownerName: user?.fullName || 'Suresh Kumar',
      requestedModel,
      capacity: requestedCapacity,
      route: requestedRoute,
      reasonNotes: requestReason,
    });

    setRequestSuccessMessage('✓ Your bus acquisition request has been sent to the Super Admin for approval.');
    setRequestReason('');
    refreshOwnerData();
    setTimeout(() => {
      setIsRequestBusOpen(false);
      setRequestSuccessMessage('');
    }, 2000);
  };

  // Handle Add Staff Submission
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffPhone) return;

    operatorStore.addStaff({
      name: newStaffName,
      role: newStaffRole,
      phone: newStaffPhone,
      bus: newStaffBus,
      tenantId: currentTenantId,
      licenseNo: newStaffLicense,
    });

    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffLicense('');
    setIsAddStaffOpen(false);
    refreshOwnerData();
  };

  const handleDeleteStaff = (staffId: string) => {
    if (window.confirm('Are you sure you want to remove this staff member from your roster?')) {
      operatorStore.deleteStaff(staffId);
      refreshOwnerData();
    }
  };

  // Handle Save Stoppage (Add or Edit)
  const handleSaveStoppage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stoppageName.trim()) return;

    if (editingStoppage) {
      transitService.updateStop(editingStoppage.id, {
        name: stoppageName.trim(),
        nameOd: stoppageNameOd.trim() || stoppageName.trim(),
        km: Number(stoppageKm) || 0,
        code: stoppageCode.trim().toUpperCase() || stoppageName.slice(0, 4).toUpperCase(),
      }, { tenantName: currentTenantName, actor: user?.fullName || 'Owner' });
      setStoppageSuccessMsg(`✓ Stoppage '${stoppageName}' updated & synchronized with all apps and Super Admin.`);
    } else {
      const added = transitService.addStop({
        name: stoppageName.trim(),
        nameOd: stoppageNameOd.trim() || stoppageName.trim(),
        lat: 0,
        lng: 0,
        km: Number(stoppageKm) || 0,
        code: stoppageCode.trim().toUpperCase() || stoppageName.slice(0, 4).toUpperCase(),
      }, { tenantName: currentTenantName, actor: user?.fullName || 'Owner' });

      // If configuring for a specific bus, attach stop
      if (selectedBusForStoppages) {
        const cur = selectedBusForStoppages.stops || stops.map(s => s.name);
        if (!cur.includes(added.name)) {
          const updatedStops = [...cur, added.name];
          operatorStore.updateBus(selectedBusForStoppages.id, { stops: updatedStops });
          transitService.updateBusStops(selectedBusForStoppages.id, updatedStops, { tenantName: currentTenantName, actor: user?.fullName || 'Owner' });
        }
      }
      setStoppageSuccessMsg(`✓ Stoppage '${stoppageName}' added to corridor & notified to Super Admin.`);
    }

    setStoppageName('');
    setStoppageNameOd('');
    setStoppageCode('');
    setEditingStoppage(null);
    setIsAddStoppageModalOpen(false);
    refreshOwnerData();
    setTimeout(() => setStoppageSuccessMsg(''), 3000);
  };

  const handleDeleteStoppage = (stopId: string, stopName: string) => {
    if (window.confirm(`Are you sure you want to delete stoppage '${stopName}'? This will remove it across all Passenger, Driver, and Conductor apps.`)) {
      transitService.deleteStop(stopId, { tenantName: currentTenantName, actor: user?.fullName || 'Owner' });
      refreshOwnerData();
    }
  };

  const handleToggleBusStop = (bus: FleetBus, stopName: string) => {
    const currentStops = bus.stops || stops.map(s => s.name);
    let updatedStops: string[];
    if (currentStops.includes(stopName)) {
      if (currentStops.length <= 2) {
        alert('A bus route must have at least 2 stops (origin & destination).');
        return;
      }
      updatedStops = currentStops.filter(s => s !== stopName);
    } else {
      updatedStops = [...currentStops, stopName];
    }
    operatorStore.updateBus(bus.id, { stops: updatedStops });
    transitService.updateBusStops(bus.id, updatedStops, { tenantName: currentTenantName, actor: user?.fullName || 'Owner' });
    refreshOwnerData();
    setSelectedBusForStoppages(prev => prev ? { ...prev, stops: updatedStops } : null);
  };

  // Live Map Markers for this Owner's Fleet Only
  const fleetMarkers: MapMarker[] = useMemo(() => {
    return buses
      .filter((bus) => (bus as any).lat && (bus as any).lng)
      .map((bus) => ({
        id: bus.id,
        lat: (bus as any).lat,
        lng: (bus as any).lng,
        title: bus.name,
        subtitle: `${bus.reg} · Speed ${bus.speed} km/h`,
        type: 'BUS',
        speed: bus.speed,
        status: bus.status,
        nextStop: (bus as any).nextStop || '',
      }));
  }, [buses]);

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#050a0f', color: '#ffffff', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>


      {/* ── OWNER 8-ITEM FIXED LEFT SIDEBAR ── */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #00D488 0%, #00875A 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 16px rgba(0,212,136,0.3)' }}>
              👑
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5, color: '#ffffff' }}>
                RURAL<span style={{ color: '#00D488' }}>BUS</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00D488', letterSpacing: 0.5 }}>
                Fleet Operator
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

        {/* 8 Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'HOME',     icon: '📊', label: 'Dashboard' },
            { id: 'BUSES',    icon: '🚌', label: 'My Buses', badge: buses.length },
            { id: 'LIVE_MAP', icon: '📍', label: 'Live Bus Tracking' },
            { id: 'STAFF',    icon: '👥', label: 'Drivers & Conductors', badge: staff.length },
            { id: 'ROUTES',   icon: '🗺️', label: 'Routes' },
            { id: 'TRIPS',    icon: '🕒', label: 'Trips' },
            { id: 'REVENUE',  icon: '💰', label: 'Revenue' },
            { id: 'PROFILE',  icon: '👤', label: 'Profile' },
          ].map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id as OwnerNavTab);
                  setIsMobileNavOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 14px',
                  borderRadius: 12,
                  backgroundColor: isActive ? 'rgba(0, 212, 136, 0.12)' : 'transparent',
                  border: isActive ? '1px solid #00D488' : '1px solid transparent',
                  color: isActive ? '#00D488' : '#cbd5e1',
                  fontSize: '0.94rem',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span style={{ background: 'rgba(0,212,136,0.15)', color: '#00D488', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 9999 }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Operator Profile Card & Sign Out */}
        <div style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#00593b', color: '#00D488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, border: '1px solid rgba(0, 212, 136, 0.3)' }}>
              SK
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.fullName || 'Suresh Kumar'}
              </div>
              <div style={{ fontSize: 11, color: '#00D488', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {currentTenantName}
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
          icon="👑"
          roleBadge="OPERATOR"
          roleBadgeColor="#00D488"
          roleBadgeBg="rgba(0, 212, 136, 0.15)"
          portalTitle="Fleet Operator Console"
          portalSubtitle={currentTenantName}
          activeViewTitle={
            activeTab === 'HOME'
              ? 'Dashboard Overview'
              : activeTab === 'BUSES'
              ? `My Fleet Buses (${buses.length})`
              : activeTab === 'LIVE_MAP'
              ? 'Live Fleet Radar'
              : activeTab === 'STAFF'
              ? `Staff Roster (${staff.length})`
              : activeTab === 'ROUTES'
              ? `Corridor Routes (${stops.length})`
              : activeTab === 'TRIPS'
              ? 'Daily Trip Manifest'
              : activeTab === 'REVENUE'
              ? 'Revenue & Collections'
              : 'Tenant Profile'
          }
          isMobileNavOpen={isMobileNavOpen}
          onToggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
          extraActions={
            <button
              type="button"
              onClick={() => setIsRequestBusOpen(true)}
              style={{
                padding: '6px 12px',
                background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📩</span>
              <span className="mobile-hide">Request Bus</span>
            </button>
          }
        />

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            padding: '16px clamp(16px, 2.5vw, 32px) 32px',
            boxSizing: 'border-box',
          }}
          className="passenger-main"
        >
        {/* ══ 1. DASHBOARD ══ */}
        {activeTab === 'HOME' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            {/* Operator Welcome Banner */}
            <div
              style={{
                background: isLight
                  ? 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)'
                  : 'linear-gradient(135deg, rgba(10, 24, 20, 0.95) 0%, rgba(10, 16, 26, 0.95) 100%)',
                border: `1.5px solid ${isLight ? '#10b981' : '#00D488'}`,
                borderRadius: 20,
                padding: '22px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                boxShadow: isLight
                  ? '0 10px 25px -5px rgba(16, 185, 129, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                  : '0 15px 35px rgba(0, 212, 136, 0.15)',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: isLight ? '#047857' : '#00D488', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  OPERATOR TENANT CONSOLE
                </div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: '4px 0 0 0' }}>
                  {currentTenantName}
                </h1>
                <div style={{ fontSize: 13, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  Administrator: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{user?.fullName || 'Transit Staff'}</strong> · Route: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{operatorStore.getTenantById(currentTenantId)?.corridor || 'Assigned Transit Corridor'}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsRequestBusOpen(true)}
                  style={{
                    padding: '11px 18px',
                    background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>📩</span>
                  <span>Request New Bus from Super Admin</span>
                </button>
              </div>
            </div>

            {/* Business KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(0, 212, 136, 0.3)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#00D488', textTransform: 'uppercase' }}>MY FLEET BUSES</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                  {buses.length} <span style={{ fontSize: '1.2rem', color: '#00D488' }}>({buses.filter(b => b.status === 'RUNNING').length} Live)</span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Assigned to your company</div>
              </div>

              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(56, 189, 248, 0.3)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>STAFF ROSTER</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', marginTop: 4 }}>{staff.length}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{staff.filter(s => s.role === 'Driver').length} Drivers · {staff.filter(s => s.role === 'Conductor').length} Conductors</div>
              </div>

              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(0, 212, 136, 0.3)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#00D488', textTransform: 'uppercase' }}>TODAY'S TOTAL REVENUE</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#00D488', marginTop: 4 }}>₹{revenue.totalRevenue.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>₹{revenue.onlineRevenue.toLocaleString()} Online + ₹{revenue.cashRevenue.toLocaleString()} Cash</div>
              </div>

              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(245, 158, 11, 0.3)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>PASSENGERS CARRIED</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#ffffff', marginTop: 4 }}>{revenue.totalPassengers}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Across all scheduled trips today</div>
              </div>
            </div>

            {/* Live Fleet Radar Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 16, color: '#ffffff' }}>Your Fleet Live Highway Radar</strong>
                <button
                  type="button"
                  onClick={() => setActiveTab('LIVE_MAP')}
                  style={{ background: 'none', border: 'none', color: '#00D488', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Fullscreen Radar ➔
                </button>
              </div>

              {fleetMarkers.length > 0 ? (
                <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0, 212, 136, 0.3)', boxShadow: '0 20px 45px rgba(0,0,0,0.6)' }}>
                  <GoogleMapView
                    center={{ lat: fleetMarkers[0].lat, lng: fleetMarkers[0].lng }}
                    zoom={10}
                    height={380}
                    markers={fleetMarkers}
                  />
                </div>
              ) : (
                <div
                  style={{
                    height: 280,
                    borderRadius: 20,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    gap: 8,
                    background: 'rgba(5, 10, 15, 0.6)',
                  }}
                >
                  <span style={{ fontSize: 28 }}>📡</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>No live GPS data</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Waiting for vehicle telemetry</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ 2. MY BUSES (OWNER SEES ONLY THEIR BUSES & CAN REQUEST NEW BUS) ══ */}
        {activeTab === 'BUSES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            <div className="owner-view-header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  My Fleet Buses ({buses.length})
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  Vehicles allocated to {currentTenantName}
                </p>
              </div>

              {/* Owner CANNOT add bus directly; must Request New Bus from Super Admin */}
              <button
                type="button"
                onClick={() => setIsRequestBusOpen(true)}
                style={{
                  padding: '12px 22px',
                  background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 16px rgba(0, 184, 122, 0.35)',
                }}
              >
                <span>📩</span>
                <span>Request New Bus from Super Admin</span>
              </button>
            </div>

            {/* Request Bus Modal */}
            {isRequestBusOpen && (
              <div style={{ background: 'rgba(10, 18, 26, 0.98)', border: '1.5px solid #00D488', borderRadius: 20, padding: 24, boxShadow: '0 20px 45px rgba(0,0,0,0.8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <strong style={{ fontSize: 17, color: '#00D488' }}>Request New Bus Allocation from Super Admin</strong>
                  <button type="button" onClick={() => setIsRequestBusOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>

                {requestSuccessMessage ? (
                  <div style={{ padding: '16px', background: 'rgba(0, 212, 136, 0.15)', border: '1px solid #00D488', borderRadius: 12, color: '#00D488', fontWeight: 800, textAlign: 'center' }}>
                    {requestSuccessMessage}
                  </div>
                ) : (
                  <form onSubmit={handleSendBusRequest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 14 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>REQUESTED MODEL / TYPE</label>
                        <input type="text" value={requestedModel} onChange={(e) => setRequestedModel(e.target.value)} placeholder="e.g. Tata Starbus Ultra 44-Seater AC" required style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>SEATS</label>
                        <input type="number" value={requestedCapacity} onChange={(e) => setRequestedCapacity(Number(e.target.value))} style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>CORRIDOR / ROUTE</label>
                      <input type="text" value={requestedRoute} onChange={(e) => setRequestedRoute(e.target.value)} placeholder="e.g. Origin ➔ Destination" required style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>JUSTIFICATION / DEMAND REASON</label>
                      <textarea value={requestReason} onChange={(e) => setRequestReason(e.target.value)} rows={3} placeholder="Explain commuter demand or route expansion rationale..." required style={{ width: '100%', padding: '11px 14px', background: isLight ? '#ffffff' : 'rgba(5,10,15,0.8)', border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none', resize: 'none' }} />
                    </div>

                    <button type="submit" style={{ padding: '13px', background: '#00B87A', color: '#fff', fontWeight: 900, borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                      Submit Bus Request to Super Admin ➔
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* My Requests Status List (if any) */}
            {myRequests.length > 0 && (
              <div
                style={{
                  background: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${isLight ? '#fed7aa' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: 16,
                  padding: 16,
                  boxShadow: isLight ? '0 4px 14px rgba(245, 158, 11, 0.08)' : 'none',
                }}
              >
                <strong style={{ fontSize: 13, color: isLight ? '#c2410c' : '#f59e0b' }}>
                  Your Submitted Bus Requests ({myRequests.length})
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {myRequests.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: isLight ? '#f8fafc' : 'rgba(10, 16, 26, 0.85)',
                        border: `1px solid ${isLight ? '#e2e8f0' : 'transparent'}`,
                        padding: '10px 14px',
                        borderRadius: 10,
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 13, color: isLight ? '#0f172a' : '#fff' }}>{r.requestedModel}</strong>
                        <span style={{ fontSize: 11, color: isLight ? '#475569' : '#94a3b8', marginLeft: 8 }}>({r.route})</span>
                      </div>
                      <span
                        style={{
                          background:
                            r.status === 'PENDING'
                              ? isLight ? '#fef3c7' : 'rgba(245,158,11,0.2)'
                              : r.status === 'APPROVED'
                              ? isLight ? '#dcfce7' : 'rgba(0,212,136,0.2)'
                              : isLight ? '#fee2e2' : 'rgba(225,29,72,0.2)',
                          color:
                            r.status === 'PENDING'
                              ? isLight ? '#b45309' : '#f59e0b'
                              : r.status === 'APPROVED'
                              ? isLight ? '#15803d' : '#00D488'
                              : isLight ? '#b91c1c' : '#fca5a5',
                          border:
                            isLight
                              ? r.status === 'PENDING'
                                ? '1px solid #fde68a'
                                : r.status === 'APPROVED'
                                ? '1px solid #bbf7d0'
                                : '1px solid #fca5a5'
                              : 'none',
                          fontSize: 10,
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buses Grid */}
            {buses.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                  borderRadius: 18,
                  border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                  boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.06)' : 'none',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🚌</div>
                <strong style={{ fontSize: 16, color: isLight ? '#0f172a' : '#ffffff', display: 'block' }}>
                  No buses added
                </strong>
                <p style={{ fontSize: 13, color: isLight ? '#64748b' : '#94a3b8', marginTop: 6, margin: '6px 0 0 0' }}>
                  No fleet vehicles have been allocated to your transport company yet. You can request a bus allocation from the Super Admin using the button above.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 14 }}>
              {buses.map((b) => {
                const assignedStops = b.stops || stops.map(s => s.name);
                return (
                  <div
                    key={b.id}
                    style={{
                      background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                      borderRadius: 18,
                      border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                      boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.06)' : 'none',
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 17, color: isLight ? '#059669' : '#00D488' }}>{b.reg}</strong>
                      <span
                        style={{
                          background: isLight ? '#dcfce7' : 'rgba(0, 212, 136, 0.15)',
                          color: isLight ? '#15803d' : '#00D488',
                          border: isLight ? '1px solid #bbf7d0' : 'none',
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {b.status} · {b.speed} km/h
                      </span>
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: isLight ? '#475569' : '#94a3b8' }}>
                      Corridor: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{b.route}</strong>
                    </div>

                    {/* Stoppage Route Sequence */}
                    <div
                      style={{
                        background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.06)'}`,
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 800, color: isLight ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                        Route Stoppages ({assignedStops.length} Stops)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        {assignedStops.slice(0, 4).map((stName, idx, arr) => (
                          <span key={stName + idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span
                              style={{
                                fontSize: 11,
                                background: isLight ? '#ecfdf5' : 'rgba(0, 212, 136, 0.12)',
                                color: isLight ? '#059669' : '#00D488',
                                border: isLight ? '1px solid #a7f3d0' : 'none',
                                padding: '2px 6px',
                                borderRadius: 6,
                                fontWeight: 700,
                              }}
                            >
                              {stName}
                            </span>
                            {idx < arr.length - 1 && <span style={{ fontSize: 10, color: isLight ? '#94a3b8' : '#64748b' }}>➔</span>}
                          </span>
                        ))}
                        {assignedStops.length > 4 && (
                          <span style={{ fontSize: 10, color: isLight ? '#64748b' : '#94a3b8', padding: '2px 4px' }}>
                            +{assignedStops.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: 12, color: isLight ? '#475569' : '#cbd5e1', display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}`, paddingTop: 8 }}>
                      <span>Driver: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{b.driver}</strong></span>
                      <span>Conductor: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{b.conductor}</strong></span>
                    </div>

                    {/* Stoppage Management Action */}
                    <button
                      type="button"
                      onClick={() => setSelectedBusForStoppages(b)}
                      style={{
                        marginTop: 4,
                        padding: '10px 14px',
                        background: isLight ? '#ecfdf5' : 'linear-gradient(135deg, rgba(0, 212, 136, 0.15) 0%, rgba(0, 135, 90, 0.25) 100%)',
                        border: `1px solid ${isLight ? '#10b981' : 'rgba(0, 212, 136, 0.4)'}`,
                        color: isLight ? '#047857' : '#00D488',
                        fontSize: 12,
                        fontWeight: 800,
                        borderRadius: 10,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <span>⚙️</span>
                      <span>Manage Stops & Corridor Sequence ➔</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

        {/* ══ 3. LIVE BUS TRACKING ══ */}
        {activeTab === 'LIVE_MAP' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Live Bus Tracking
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                Real-time GPS radar tracking for your {buses.length} fleet vehicles
              </p>
            </div>

            {fleetMarkers.length > 0 ? (
              <div style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(0, 212, 136, 0.3)'}`, boxShadow: isLight ? '0 10px 25px rgba(0,0,0,0.05)' : '0 20px 45px rgba(0,0,0,0.6)' }}>
                <GoogleMapView
                  center={{ lat: fleetMarkers[0].lat, lng: fleetMarkers[0].lng }}
                  zoom={10}
                  height={540}
                  markers={fleetMarkers}
                />
              </div>
            ) : (
              <div
                style={{
                  height: 360,
                  borderRadius: 20,
                  border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isLight ? '#64748b' : '#94a3b8',
                  gap: 10,
                  background: isLight ? '#f8fafc' : 'rgba(5, 10, 15, 0.6)',
                }}
              >
                <span style={{ fontSize: 36 }}>📡</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>No live GPS data</span>
                <span style={{ fontSize: 12, color: isLight ? '#94a3b8' : '#64748b' }}>Waiting for vehicle telemetry</span>
              </div>
            )}
          </div>
        )}

        {/* ══ 4. STAFF MANAGEMENT ══ */}
        {activeTab === 'STAFF' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            <div className="owner-view-header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  Fleet Staff Management ({staff.length})
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  Manage authorized operational staff for {currentTenantName}
                </p>
              </div>

              {/* Owner CAN add staff */}
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(true)}
                style={{ padding: '12px 20px', background: '#0284c7', color: '#fff', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                + Add Staff Member
              </button>
            </div>

            {/* Add Staff Modal */}
            {isAddStaffOpen && (
              <div style={{ background: isLight ? '#ffffff' : 'rgba(10, 18, 26, 0.98)', border: `1.5px solid ${isLight ? '#cbd5e1' : '#38bdf8'}`, borderRadius: 20, padding: 24, boxShadow: isLight ? '0 20px 45px rgba(15, 23, 42, 0.15)' : '0 20px 45px rgba(0,0,0,0.8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <strong style={{ fontSize: 17, color: isLight ? '#0284c7' : '#38bdf8' }}>Register New Driver / Conductor</strong>
                  <button type="button" onClick={() => setIsAddStaffOpen(false)} style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>

                <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 4 }}>FULL NAME</label>
                      <input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="e.g. Dilip Mohanty" required style={{ width: '100%', padding: '11px 14px', background: isLight ? '#f8fafc' : 'rgba(5,10,15,0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 4 }}>ROLE</label>
                      <select value={newStaffRole} onChange={(e) => setNewStaffRole(e.target.value as any)} style={{ width: '100%', padding: '11px 14px', background: isLight ? '#f8fafc' : '#050a0f', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none' }}>
                        <option value="Driver" style={{ background: isLight ? '#ffffff' : '#050a0f', color: isLight ? '#0f172a' : '#ffffff' }}>Driver</option>
                        <option value="Conductor" style={{ background: isLight ? '#ffffff' : '#050a0f', color: isLight ? '#0f172a' : '#ffffff' }}>Conductor</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 4 }}>MOBILE NUMBER</label>
                      <input type="tel" value={newStaffPhone} onChange={(e) => setNewStaffPhone(e.target.value)} placeholder="10-digit mobile" required style={{ width: '100%', padding: '11px 14px', background: isLight ? '#f8fafc' : 'rgba(5,10,15,0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 4 }}>ASSIGNED BUS</label>
                      <select value={newStaffBus} onChange={(e) => setNewStaffBus(e.target.value)} style={{ width: '100%', padding: '11px 14px', background: isLight ? '#f8fafc' : '#050a0f', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none' }}>
                        {buses.map((b) => (
                          <option key={b.id} value={b.reg} style={{ background: isLight ? '#ffffff' : '#050a0f', color: isLight ? '#0f172a' : '#ffffff' }}>{b.reg} ({b.name})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 4 }}>LICENSE / BADGE NUMBER</label>
                    <input type="text" value={newStaffLicense} onChange={(e) => setNewStaffLicense(e.target.value)} placeholder="e.g. DL-01-2020-009911" style={{ width: '100%', padding: '11px 14px', background: isLight ? '#f8fafc' : 'rgba(5,10,15,0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none' }} />
                  </div>

                  <button type="submit" style={{ padding: '13px', background: '#0284c7', color: '#fff', fontWeight: 900, borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                    Save Staff Member
                  </button>
                </form>
              </div>
            )}

            {/* Staff Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
              {staff.map((s) => (
                <div key={s.id} style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(255, 255, 255, 0.08)', padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 16, color: '#ffffff' }}>{s.name}</strong>
                    <span style={{ background: s.role === 'Driver' ? 'rgba(56,189,248,0.2)' : 'rgba(245,158,11,0.2)', color: s.role === 'Driver' ? '#38bdf8' : '#f59e0b', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                      {s.role}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Phone: {s.phone}</div>
                  <div style={{ fontSize: 12, color: '#00D488', marginTop: 2 }}>Assigned Bus: <strong>{s.bus}</strong></div>
                  <button type="button" onClick={() => handleDeleteStaff(s.id)} style={{ marginTop: 8, width: '100%', padding: '6px', background: 'rgba(225,29,72,0.15)', border: '1px solid rgba(225,29,72,0.3)', color: '#fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    Remove Staff
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ 5. ROUTES & STOPPAGE MANAGEMENT (BUS LOCATION WISE CARDS) ══ */}
        {activeTab === 'ROUTES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            <div className="owner-view-header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  Fleet Bus Routes & Corridors ({buses.length})
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  Corridor routes and sequential stoppages organized vehicle-by-vehicle for {currentTenantName}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingStoppage(null);
                  setStoppageName('');
                  setStoppageNameOd('');
                  setStoppageKm(50);
                  setStoppageCode('');
                  setIsAddStoppageModalOpen(true);
                }}
                style={{
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, #00B87A 0%, #00875A 100%)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>+</span>
                <span>Add New Stoppage</span>
              </button>
            </div>

            {stoppageSuccessMsg && (
              <div style={{ padding: '12px 16px', background: 'rgba(0, 212, 136, 0.15)', border: '1px solid #00D488', borderRadius: 12, color: '#00D488', fontWeight: 800, fontSize: 13 }}>
                {stoppageSuccessMsg}
              </div>
            )}

            {/* Operator Corridor Summary Banner */}
            <div style={{
              background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
              borderRadius: 16,
              border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(0, 212, 136, 0.25)'}`,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#00D488', letterSpacing: 0.5 }}>
                  Main Operating Corridor
                </span>
                <div style={{ fontSize: 16, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>
                  {operatorStore.getTenantById(currentTenantId)?.corridor || 'Bangalore ➔ Mysore Expressway Corridor'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8' }}>
                  Verified Highway Stoppages: <strong style={{ color: '#00D488' }}>{stops.length}</strong>
                </span>
                <span style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8' }}>
                  Allocated Fleet Buses: <strong style={{ color: '#00D488' }}>{buses.length}</strong>
                </span>
              </div>
            </div>

            {/* BUS-LOCATION-WISE ROUTE CARDS */}
            {buses.length === 0 ? (
              <div style={{
                background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                borderRadius: 20,
                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                padding: 36,
                textAlign: 'center',
                boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
              }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🚌</div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  No Bus Routes Allocated Yet
                </h2>
                <p style={{ fontSize: 14, color: isLight ? '#64748b' : '#94a3b8', maxWidth: 580, margin: '10px auto 24px', lineHeight: 1.6 }}>
                  Highway corridor routes and stoppage checkpoints are organized on dedicated vehicle cards. Once Super Admin registers and allocates a bus to <strong>{currentTenantName}</strong>, its dedicated route card and stop progression will appear here without mixing.
                </p>

                {/* Master Corridor Stoppages Preview */}
                <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'left', background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', borderRadius: 14, padding: '18px 20px', border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#00D488', textTransform: 'uppercase', marginBottom: 12 }}>
                    Corridor Template Ready For Fleet Assignment (BLR-MYS-01):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {stops.map((s, idx) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: isLight ? '#ffffff' : 'rgba(5, 10, 15, 0.8)', borderRadius: 8, border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0, 212, 136, 0.15)', color: '#00D488', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {idx + 1}
                          </span>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>{s.name}</span>
                            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>({s.code})</span>
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#00D488' }}>{s.km} km</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {buses.map((bus) => {
                  const busStopsList = (bus.stops && bus.stops.length > 0)
                    ? bus.stops
                    : stops.map((s) => s.name);
                  const matchedStops = busStopsList.map((name) => {
                    const match = stops.find((s) => s.name.toLowerCase() === name.toLowerCase());
                    return match || { id: name, name, nameOd: name, km: 0, code: name.slice(0, 4).toUpperCase(), lat: 0, lng: 0 };
                  });

                  return (
                    <div
                      key={bus.id}
                      style={{
                        background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.88)',
                        borderRadius: 20,
                        border: `1.5px solid ${isLight ? '#e2e8f0' : 'rgba(0, 212, 136, 0.25)'}`,
                        padding: 24,
                        boxShadow: isLight ? '0 4px 18px rgba(15, 23, 42, 0.06)' : '0 4px 20px rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 18,
                      }}
                    >
                      {/* Card Header: Bus Info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: `1px solid ${isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)'}`, paddingBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, rgba(0, 212, 136, 0.2) 0%, rgba(0, 135, 90, 0.2) 100%)', border: '1px solid rgba(0, 212, 136, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                            🚌
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 18, fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', letterSpacing: -0.3 }}>
                                {bus.reg}
                              </span>
                              <span style={{ background: isLight ? '#eff6ff' : 'rgba(56, 189, 248, 0.15)', color: isLight ? '#0284c7' : '#38bdf8', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                                {bus.name}
                              </span>
                              <span style={{ background: 'rgba(0, 212, 136, 0.15)', color: '#00D488', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                                {bus.status}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', marginTop: 4 }}>
                              Assigned Staff: <strong>Driver {bus.driver || 'Unassigned'}</strong> · <strong>Conductor {bus.conductor || 'Unassigned'}</strong> · {bus.seats || 40} Seats
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setSelectedBusForStoppages(bus)}
                            style={{
                              padding: '8px 14px',
                              background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                              border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)'}`,
                              borderRadius: 8,
                              color: isLight ? '#0f172a' : '#ffffff',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span>⚙️</span>
                            <span>Configure Stops</span>
                          </button>
                        </div>
                      </div>

                      {/* Corridor Detail Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.5)', padding: '10px 16px', borderRadius: 10, border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.05)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14 }}>📍</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>
                            Route Corridor: <span style={{ color: '#00D488' }}>{bus.route || 'Bangalore ➔ Mysore'}</span>
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8' }}>
                          {matchedStops.length} Stoppage Checkpoints
                        </span>
                      </div>

                      {/* Stoppage Progression Timeline for THIS Bus */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: isLight ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                          Sequential Stoppages on {bus.reg} Route:
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                          {matchedStops.map((s, idx) => (
                            <div
                              key={`${bus.id}-${s.id || idx}`}
                              style={{
                                background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.8)',
                                padding: '12px 14px',
                                borderRadius: 12,
                                border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.08)'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(0, 212, 136, 0.15)', color: '#00D488', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff' }}>
                                      {s.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>
                                      Code: {s.code}
                                    </div>
                                  </div>
                                </div>
                                <span style={{ fontSize: 11, background: isLight ? '#eff6ff' : 'rgba(56, 189, 248, 0.15)', color: isLight ? '#1d4ed8' : '#38bdf8', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                                  {s.km} km
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}`, paddingTop: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStoppage(s as MasterStop);
                                    setStoppageName(s.name);
                                    setStoppageNameOd(s.nameOd);
                                    setStoppageKm(s.km);
                                    setStoppageCode(s.code);
                                    setIsAddStoppageModalOpen(true);
                                  }}
                                  style={{ flex: 1, padding: '4px 6px', background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.06)', border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.12)'}`, color: isLight ? '#0f172a' : '#e2e8f0', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStoppage(s.id, s.name)}
                                  style={{ padding: '4px 8px', background: isLight ? '#fee2e2' : 'rgba(225,29,72,0.15)', border: `1px solid ${isLight ? '#fca5a5' : 'rgba(225,29,72,0.3)'}`, color: isLight ? '#b91c1c' : '#fca5a5', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ 6. TRIPS ══ */}
        {activeTab === 'TRIPS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            <div className="owner-view-header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  Daily Trip Schedules & Manifest
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  Active trips operating today across your fleet
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {buses.map((b, idx) => (
                <div key={b.id} style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.08)', padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ fontSize: 16, color: '#00D488' }}>Trip #{101 + idx}</strong>
                      <span style={{ fontSize: 14, color: '#fff', fontWeight: 700 }}>{b.name} ({b.reg})</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      Departure: 06:{idx * 15 || '00'} AM · Driver: {b.driver} · Conductor: {b.conductor}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ background: 'rgba(0, 212, 136, 0.15)', color: '#00D488', fontSize: 11, fontWeight: 900, padding: '4px 10px', borderRadius: 6 }}>
                      IN TRANSIT (LIVE)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ 7. REVENUE (OWNER SEES ONLY THEIR REVENUE) ══ */}
        {activeTab === 'REVENUE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            <div className="owner-view-header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  Revenue & Collection Breakdown
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  Daily financial reports for {currentTenantName}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {/* Online Bookings Revenue */}
              <div style={{ background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)', borderRadius: 20, padding: 24, border: `1.5px solid ${isLight ? '#86efac' : 'rgba(0, 212, 136, 0.35)'}`, boxShadow: isLight ? '0 4px 14px rgba(16, 185, 129, 0.08)' : 'none' }}>
                <div style={{ fontSize: 11, color: isLight ? '#047857' : '#00D488', fontWeight: 800, textTransform: 'uppercase' }}>ONLINE PASSENGER BOOKINGS</div>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, color: isLight ? '#047857' : '#00D488', marginTop: 4 }}>₹{revenue.onlineRevenue.toLocaleString()}</div>
                <div style={{ fontSize: 13, color: isLight ? '#475569' : '#cbd5e1', marginTop: 4 }}>{revenue.onlineTicketCount} Verified Digital Tickets</div>
              </div>

              {/* Cash POS Revenue */}
              <div style={{ background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)', borderRadius: 20, padding: 24, border: `1.5px solid ${isLight ? '#fde68a' : 'rgba(245, 158, 11, 0.35)'}`, boxShadow: isLight ? '0 4px 14px rgba(245, 158, 11, 0.08)' : 'none' }}>
                <div style={{ fontSize: 11, color: isLight ? '#b45309' : '#f59e0b', fontWeight: 800, textTransform: 'uppercase' }}>CONDUCTOR CASH POS COLLECTION</div>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, color: isLight ? '#b45309' : '#f59e0b', marginTop: 4 }}>₹{revenue.cashRevenue.toLocaleString()}</div>
                <div style={{ fontSize: 13, color: isLight ? '#475569' : '#cbd5e1', marginTop: 4 }}>{revenue.cashTicketCount} Handheld Tickets Issued</div>
              </div>

              {/* Combined Total */}
              <div style={{ background: isLight ? 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)' : 'linear-gradient(135deg, rgba(10, 24, 20, 0.95) 0%, rgba(10, 16, 26, 0.95) 100%)', borderRadius: 20, padding: 24, border: `1.5px solid ${isLight ? '#10b981' : '#00D488'}`, boxShadow: isLight ? '0 10px 25px -5px rgba(16, 185, 129, 0.12)' : 'none' }}>
                <div style={{ fontSize: 11, color: isLight ? '#475569' : '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>TOTAL NET COLLECTION TODAY</div>
                <div style={{ fontSize: '2.8rem', fontWeight: 900, color: isLight ? '#047857' : '#ffffff', marginTop: 4 }}>₹{revenue.totalRevenue.toLocaleString()}</div>
                <div style={{ fontSize: 13, color: isLight ? '#047857' : '#00D488', marginTop: 4 }}>{revenue.totalPassengers} Total Passengers Transported</div>
              </div>
            </div>
          </div>
        )}

        {/* ══ 8. PROFILE ══ */}
        {activeTab === 'PROFILE' && (
          <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Operator Administrator Profile
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                Tenant credentials and business details
              </p>
            </div>

            <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 24, border: '1.5px solid rgba(0, 212, 136, 0.3)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#00593b', border: '1px solid #00D488', color: '#00D488', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                  SK
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff' }}>{user?.fullName || 'Suresh Kumar'}</div>
                  <div style={{ fontSize: 12, color: '#00D488', fontWeight: 700, marginTop: 2 }}>{currentTenantName}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>CONTACT MOBILE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{user?.phone || '9876500002'}</div>
                </div>
                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>OPERATING CORRIDOR</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{operatorStore.getTenantById(currentTenantId)?.corridor || 'Assigned Transit Corridor'}</div>
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
                <span>Log Out</span>
              </button>
            </div>
          </div>
        )}

        {/* ══ MODAL 1: MANAGE BUS STOPPAGES / ROUTE STOPS ══ */}
        {selectedBusForStoppages && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.82)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                background: 'rgba(10, 16, 26, 0.98)',
                border: '1.5px solid #00D488',
                borderRadius: 22,
                padding: 24,
                maxWidth: 680,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🚌</span>
                    <strong style={{ fontSize: 18, color: '#ffffff' }}>{selectedBusForStoppages.reg}</strong>
                    <span style={{ background: 'rgba(0, 212, 136, 0.15)', color: '#00D488', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6 }}>
                      {selectedBusForStoppages.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    Route: <strong style={{ color: '#00D488' }}>{selectedBusForStoppages.route}</strong> · Manage designated boarding and drop-off stops
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBusForStoppages(null)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {stoppageSuccessMsg && (
                <div style={{ padding: '10px 14px', background: 'rgba(0, 212, 136, 0.15)', border: '1px solid #00D488', borderRadius: 10, color: '#00D488', fontWeight: 800, fontSize: 12 }}>
                  {stoppageSuccessMsg}
                </div>
              )}

              {/* Action: Add new stoppage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 14px', borderRadius: 12 }}>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>Need to add a new stop to this highway?</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingStoppage(null);
                    setStoppageName('');
                    setStoppageNameOd('');
                    setStoppageKm(50);
                    setStoppageCode('');
                    setIsAddStoppageModalOpen(true);
                  }}
                  style={{
                    padding: '8px 14px',
                    background: '#00B87A',
                    color: '#fff',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  + Add New Stoppage
                </button>
              </div>

              {/* Stoppage Checklist */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Corridor Stoppages (Check to include on this bus trip):
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                  {stops.map((s) => {
                    const isChecked = (selectedBusForStoppages.stops || stops.map(st => st.name)).includes(s.name);
                    return (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isChecked ? 'rgba(0, 212, 136, 0.08)' : 'rgba(15, 23, 42, 0.5)',
                          border: `1px solid ${isChecked ? 'rgba(0, 212, 136, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                          padding: '10px 14px',
                          borderRadius: 10,
                        }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleBusStop(selectedBusForStoppages, s.name)}
                            style={{ width: 16, height: 16, accentColor: '#00D488', cursor: 'pointer' }}
                          />
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 800, color: isChecked ? '#fff' : '#94a3b8' }}>
                              {s.name}
                            </span>
                            <span style={{ fontSize: 11, color: '#00D488', marginLeft: 6 }}>
                              ({s.nameOd})
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                              · {s.km} km
                            </span>
                          </div>
                        </label>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStoppage(s);
                              setStoppageName(s.name);
                              setStoppageNameOd(s.nameOd);
                              setStoppageKm(s.km);
                              setStoppageCode(s.code);
                              setIsAddStoppageModalOpen(true);
                            }}
                            style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStoppage(s.id, s.name)}
                            style={{ padding: '4px 8px', background: 'rgba(225,29,72,0.15)', border: '1px solid rgba(225,29,72,0.3)', color: '#fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 14 }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  ✓ Any change automatically syncs with Passenger, Driver & Conductor apps and alerts Super Admin.
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedBusForStoppages(null)}
                  style={{ padding: '10px 20px', background: '#00D488', color: '#000', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL 2: ADD / EDIT STOPPAGE MODAL ══ */}
        {isAddStoppageModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              style={{
                background: 'rgba(10, 18, 26, 0.98)',
                border: '1.5px solid #00D488',
                borderRadius: 20,
                padding: 24,
                maxWidth: 480,
                width: '100%',
                boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <strong style={{ fontSize: 17, color: '#00D488' }}>
                  {editingStoppage ? `Edit Stoppage: ${editingStoppage.name}` : 'Add New Corridor Stoppage'}
                </strong>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddStoppageModalOpen(false);
                    setEditingStoppage(null);
                  }}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveStoppage} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                    STOPPAGE NAME (ENGLISH) *
                  </label>
                  <input
                    type="text"
                    value={stoppageName}
                    onChange={(e) => setStoppageName(e.target.value)}
                    placeholder="e.g. Central Junction"
                    required
                    style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                    STOPPAGE NAME (LOCAL LANGUAGE - OPTIONAL)
                  </label>
                  <input
                    type="text"
                    value={stoppageNameOd}
                    onChange={(e) => setStoppageNameOd(e.target.value)}
                    placeholder="e.g. Regional Stop Name"
                    style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                      HIGHWAY DISTANCE (KM)
                    </label>
                    <input
                      type="number"
                      value={stoppageKm}
                      onChange={(e) => setStoppageKm(Number(e.target.value))}
                      min={0}
                      max={500}
                      required
                      style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>
                      CODE (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      value={stoppageCode}
                      onChange={(e) => setStoppageCode(e.target.value)}
                      placeholder="e.g. NLCO"
                      style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ padding: '10px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: 10, fontSize: 11, color: '#38bdf8' }}>
                  ℹ️ Saving this stoppage will instantly notify Super Admin and reflect in Find Bus, Conductor POS, and Driver navigation.
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddStoppageModalOpen(false);
                      setEditingStoppage(null);
                    }}
                    style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.08)', color: '#94a3b8', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 2, padding: '12px', background: '#00B87A', color: '#fff', borderRadius: 10, border: 'none', fontWeight: 900, cursor: 'pointer' }}
                  >
                    {editingStoppage ? 'Save Changes' : 'Add Stoppage & Notify Super Admin'}
                  </button>
                </div>
              </form>
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
