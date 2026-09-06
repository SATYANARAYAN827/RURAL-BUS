import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAdminAuthStore } from '../stores/auth.store.js';
import { GoogleMapView, MapMarker } from '../components/maps/GoogleMapView.js';
import { apiClient } from '../services/api.client.js';
import { TopHeader } from '../components/layout/TopHeader.js';
import { useThemeStore } from '../stores/theme.store.js';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal.js';

type SuperAdminNavTab = 'HOME' | 'OWNERS' | 'BUSES' | 'STAFF' | 'ROUTES' | 'TRIPS' | 'REQUESTS' | 'PROFILE';

// API response types
interface TenantOwner {
  id: string;
  companyName: string;
  ownerName?: string;
  businessCode?: string;
  contactEmail?: string;
  contactPhone?: string;
  phone?: string;
  email?: string;
  corridor?: string;
  busesCount?: number;
  staffCount?: number;
  status: string;
  createdAt: string;
}

interface FleetBus {
  id: string;
  tenantId: string;
  name: string;
  reg: string;
  registrationNumber: string;
  model: string;
  requestedModel?: string;
  seats: number;
  totalSeats: number;
  capacity?: number;
  status: string;
  tenantName?: string;
  operatorName?: string;
  ownerName?: string;
  driver?: string;
  conductor?: string;
  route?: string;
  lat?: number;
  lng?: number;
  speed?: number;
  reasonNotes?: string;
  createdAt?: string;
}

interface FleetStaff {
  id: string;
  userId: string;
  name: string;
  fullName?: string;
  phone: string;
  role: string;
  isActive: boolean;
  tenantId: string;
  tenantName?: string;
  bus?: string;
}

interface AdminNotification {
  id: string;
  message: string;
  read: boolean;
  type: string;
  title: string;
  timestamp: string;
  tenantName: string;
  createdAt?: string;
}

export function SuperAdminDashboard() {
  const { user, logout } = useAdminAuthStore();
  const { theme } = useThemeStore();
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<SuperAdminNavTab>('HOME');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // API data state
  const [tenants, setTenants] = useState<TenantOwner[]>([]);
  const [buses, setBuses] = useState<FleetBus[]>([]);
  const [staff, setStaff] = useState<FleetStaff[]>([]);
  const [pendingBusRequests, setPendingBusRequests] = useState<FleetBus[]>([]);
  const [stops] = useState<{ id: string; name: string; km?: number }[]>([
    { id: 'stop-1', name: 'Angul Central Depot', km: 0 },
    { id: 'stop-2', name: 'Banarpal Junction', km: 12 },
    { id: 'stop-3', name: 'Nalco Nagar Gate', km: 25 },
    { id: 'stop-4', name: 'Talcher Thermal Station', km: 42 },
    { id: 'stop-5', name: 'Kaniha Rural Terminal', km: 68 },
  ]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isNotifsOpen, setIsNotifsOpen] = useState(false);

  // Selected Owner for Step-by-Step Detailed View
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [ownerDetailStep, setOwnerDetailStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Modals State
  const [isAddOwnerOpen, setIsAddOwnerOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [newOwnerCorridor, setNewOwnerCorridor] = useState('');
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [isSubmittingOwner, setIsSubmittingOwner] = useState(false);
  const [createdOwnerSuccess, setCreatedOwnerSuccess] = useState<{
    companyName: string;
    ownerName: string;
    role: string;
    username: string;
    accountId: string;
    smsStatus: string;
    smsSent: boolean;
  } | null>(null);

  const [isAddBusOpen, setIsAddBusOpen] = useState(false);
  const [busTargetTenantId, setBusTargetTenantId] = useState('');
  const [newBusReg, setNewBusReg] = useState('');
  const [newBusName, setNewBusName] = useState('');
  const [newBusRoute, setNewBusRoute] = useState('');
  const [newBusSeats, setNewBusSeats] = useState(40);
  const [busError, setBusError] = useState<string | null>(null);
  const [isSubmittingBus, setIsSubmittingBus] = useState(false);

  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [staffTargetTenantId, setStaffTargetTenantId] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Driver' | 'Conductor'>('Driver');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffBus, setNewStaffBus] = useState('');

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [approvedBusReg, setApprovedBusReg] = useState('');

  // Load All Data from API
  const refreshData = useCallback(async () => {
    try {
      const [ownersRes, busesRes, pendingRes, staffRes] = await Promise.all([
        apiClient.get('/api/v1/tenant/operators').catch(() => null),
        apiClient.get('/api/v1/operator/buses').catch(() => null),
        apiClient.get('/api/v1/admin/bus-requests').catch(() => null),
        apiClient.get('/api/v1/operator/staff').catch(() => null),
      ]);

      const busList: FleetBus[] = busesRes?.data?.buses
        ? busesRes.data.buses.map((b: any) => ({
            id: b.id,
            tenantId: b.tenantId,
            name: b.registrationNumber,
            reg: b.registrationNumber,
            registrationNumber: b.registrationNumber,
            model: b.model,
            seats: b.totalSeats,
            totalSeats: b.totalSeats,
            capacity: b.totalSeats,
            status: b.status,
            operatorName: b.operatorName,
            tenantName: b.operatorName,
            route: b.route || 'Assigned Corridor Route',
            conductor: b.conductor || '',
            driver: b.driver || '',
            lat: b.lat,
            lng: b.lng,
            speed: b.speed,
            createdAt: b.createdAt,
          }))
        : [];
      setBuses(busList);

      const staffList: FleetStaff[] = staffRes?.data?.staff
        ? staffRes.data.staff.map((s: any) => ({
            id: s.id,
            userId: s.userId || s.id,
            name: s.fullName || s.name,
            fullName: s.fullName || s.name,
            phone: s.phone,
            role: s.role,
            isActive: s.isActive ?? true,
            tenantId: s.tenantId,
            tenantName: s.tenantName || '',
            bus: s.busRegistrationNumber || s.bus || '',
          }))
        : [];
      setStaff(staffList);

      if (ownersRes?.data?.operators) {
        setTenants(
          ownersRes.data.operators.map((o: any) => ({
            id: o.id,
            companyName: o.companyName,
            ownerName: o.ownerName || '',
            businessCode: o.businessCode,
            contactEmail: o.contactEmail || o.email || '',
            contactPhone: o.contactPhone || o.phone || '',
            phone: o.contactPhone || o.phone || '',
            email: o.contactEmail || o.email || '',
            corridor: o.corridor || 'State Rural Corridor',
            busesCount: busList.filter((b) => b.tenantId === o.id).length,
            staffCount: staffList.filter((s) => s.tenantId === o.id).length,
            status: o.status,
            createdAt: o.createdAt,
          }))
        );
      }

      if (pendingRes?.data?.buses) {
        setPendingBusRequests(
          pendingRes.data.buses.map((b: any) => ({
            id: b.id,
            tenantId: b.tenantId,
            name: b.registrationNumber,
            reg: b.registrationNumber,
            registrationNumber: b.registrationNumber,
            model: b.model,
            requestedModel: b.model,
            seats: b.totalSeats,
            totalSeats: b.totalSeats,
            capacity: b.totalSeats,
            status: b.status,
            operatorName: b.operatorName,
            tenantName: b.operatorName,
            route: b.route || 'Rural Service Route',
            reasonNotes: b.reasonNotes || 'Operator requested addition of new commercial passenger vehicle to rural route.',
            createdAt: b.createdAt,
          }))
        );
      }
    } catch (err) {
      console.warn('SuperAdmin refreshData failed:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Derived requests for JSX
  const requests = useMemo(() => {
    return pendingBusRequests.map((b) => ({
      ...b,
      requestedModel: b.model,
      capacity: b.totalSeats || b.seats,
      route: b.route || 'Rural Service Corridor',
      reasonNotes: b.reasonNotes || 'Operator requested addition of new commercial passenger vehicle to rural route.',
      createdAt: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Today',
    }));
  }, [pendingBusRequests]);

  // Unread Notifications Count
  const unreadNotifsCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Selected Tenant Details
  const selectedTenant = useMemo(() => {
    if (!selectedOwnerId) return null;
    return tenants.find((t) => t.id === selectedOwnerId) || null;
  }, [tenants, selectedOwnerId]);

  const selectedTenantBuses = useMemo(() => {
    if (!selectedOwnerId) return [];
    return buses.filter((b) => b.tenantId === selectedOwnerId);
  }, [buses, selectedOwnerId]);

  const selectedTenantStaff = useMemo(() => {
    if (!selectedOwnerId) return [];
    return staff.filter((s: any) => s.tenantId === selectedOwnerId);
  }, [staff, selectedOwnerId]);

  // Create Transport Owner — calls real backend
  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerError(null);

    const companyName = newCompanyName.trim();
    const ownerName = newOwnerName.trim();
    const phone = newOwnerPhone.trim();
    const email = newOwnerEmail.trim().toLowerCase();
    const password = newOwnerPassword.trim();

    if (!companyName || !ownerName || !phone || !email || !password) {
      setOwnerError('All fields including initial password are required.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setOwnerError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }

    if (password.length < 8) {
      setOwnerError('Initial password must be at least 8 characters long.');
      return;
    }

    setIsSubmittingOwner(true);
    try {
      const result = await apiClient.post('/api/v1/tenant/operators', {
        companyName,
        ownerName,
        phone,
        email,
        password,
        corridor: newOwnerCorridor.trim(),
      });

      setNewCompanyName('');
      setNewOwnerName('');
      setNewOwnerPhone('');
      setNewOwnerEmail('');
      setNewOwnerPassword('');
      setNewOwnerCorridor('');
      setOwnerError(null);
      setIsAddOwnerOpen(false);

      const data = result?.data;
      const smsSent = data?.sms?.sent ?? false;
      const maskedPhone = data?.sms?.maskedPhone || `+91 ${phone.slice(0, 2)}****${phone.slice(-4)}`;
      const smsStatus = smsSent
        ? `Sent to ${maskedPhone}`
        : `Account created, SMS delivery pending: ${data?.sms?.message || 'No live SMS gateway configured'}`;

      setCreatedOwnerSuccess({
        companyName: data?.tenant?.companyName || companyName,
        ownerName: data?.tenant?.ownerName || ownerName,
        role: 'Owner',
        username: phone,
        accountId: data?.tenant?.id || '',
        smsStatus,
        smsSent,
      });

      await refreshData();
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create transport owner';
      setOwnerError(errMsg);
    } finally {
      setIsSubmittingOwner(false);
    }
  };

  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    const reg = newBusReg.trim().toUpperCase();
    const tenantId = busTargetTenantId || selectedTenant?.id || tenants[0]?.id;

    if (!reg || !tenantId) {
      setBusError('Please provide target operator and registration number.');
      return;
    }

    setIsSubmittingBus(true);
    setBusError(null);

    try {
      await apiClient.post('/api/v1/operator/buses', {
        registrationNumber: reg,
        model: newBusName.trim() || 'Standard Bus',
        totalSeats: newBusSeats || 40,
        seatingType: 'SEATER_2X2',
        tenantId,
        route: newBusRoute.trim() || undefined,
      });

      setNewBusReg('');
      setNewBusName('');
      setNewBusRoute('');
      setBusError(null);
      setIsAddBusOpen(false);
      await refreshData();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error?.message || err?.message || 'Unable to register bus';
      setBusError(errMsg);
    } finally {
      setIsSubmittingBus(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffPhone || !staffTargetTenantId) return;
    const tempPassword = `Temp${Math.floor(1000 + Math.random() * 9000)}!`;
    try {
      await apiClient.post('/api/v1/operator/staff', {
        fullName: newStaffName,
        phone: newStaffPhone,
        role: newStaffRole === 'Driver' ? 'DRIVER' : 'CONDUCTOR',
        password: tempPassword,
        tenantId: staffTargetTenantId,
        bus: newStaffBus || undefined,
      });
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffBus('');
      setIsAddStaffOpen(false);
      refreshData();
    } catch (err: any) {
      alert('Failed to create staff: ' + (err.message || 'Unknown error'));
    }
  };

  const handleApproveBusRequest = async (busId: string) => {
    try {
      await apiClient.put(`/api/v1/operator/buses/${busId}/approve`);
      setIsApproveModalOpen(false);
      setSelectedRequestId(null);
      setApprovedBusReg('');
      refreshData();
    } catch (err: any) {
      alert('Approval failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleRejectBusRequest = async (busId: string) => {
    if (!window.confirm('Reject this bus registration request? The bus will be deleted.')) return;
    try {
      await apiClient.delete(`/api/v1/operator/buses/${busId}`);
      refreshData();
    } catch (err: any) {
      alert('Rejection failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteBus = async (busId: string) => {
    const targetBus = buses.find((b) => b.id === busId);
    if (targetBus && targetBus.status === 'RUNNING') {
      alert(`⚠️ Cannot remove ${targetBus.reg}: Vehicle is actively IN TRANSIT.`);
      return;
    }
    if (window.confirm('Are you sure you want to delete this bus from the fleet?')) {
      try {
        await apiClient.delete(`/api/v1/operator/buses/${busId}`);
        refreshData();
      } catch (err: any) {
        alert('Delete failed: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (window.confirm('Are you sure you want to remove this staff member?')) {
      try {
        await apiClient.delete(`/api/v1/operator/staff/${staffId}`);
        refreshData();
      } catch (err: any) {
        alert('Delete failed: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleToggleOwnerStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiClient.put(`/api/v1/tenant/operators/${tenantId}`, { status: nextStatus });
      refreshData();
    } catch {
      // optimistic local update if API not wired
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, status: nextStatus } : t));
    }
  };

  // Map markers for live map
  const fleetMarkers: MapMarker[] = useMemo(() => {
    return buses
      .filter((bus) => (bus as any).lat && (bus as any).lng)
      .map((bus) => ({
        id: bus.id,
        lat: (bus as any).lat,
        lng: (bus as any).lng,
        title: bus.name,
        subtitle: `${bus.reg} · ${bus.tenantName || bus.operatorName}`,
        type: 'BUS',
        speed: bus.speed,
        status: (bus.status === 'RUNNING' || bus.status === 'HALTED' || bus.status === 'STOPPED' || bus.status === 'COMPLETED' ? bus.status : 'STOPPED') as any,
        nextStop: (bus as any).nextStop || '',
      }));
  }, [buses]);

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#050a0f', color: '#ffffff', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>


      {/* ── SUPER ADMIN 8-ITEM FIXED LEFT SIDEBAR ── */}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 16px rgba(168,85,247,0.4)' }}>
              ⚡
            </div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.5, color: '#ffffff' }}>
                RURAL<span style={{ color: '#00D488' }}>BUS</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', letterSpacing: 0.5 }}>
                Super Admin Console
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

        {/* Real-time Owner Activity / Notifications Trigger */}
        <button
          type="button"
          onClick={() => setIsNotifsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: 12,
            background: unreadNotifsCount > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${unreadNotifsCount > 0 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
            color: unreadNotifsCount > 0 ? '#f59e0b' : '#cbd5e1',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔔</span>
            <span>Owner Audit Logs</span>
          </div>
          {unreadNotifsCount > 0 ? (
            <span style={{ background: '#f59e0b', color: '#000', borderRadius: 6, padding: '1px 6px', fontSize: 10, fontWeight: 900 }}>
              {unreadNotifsCount} NEW
            </span>
          ) : (
            <span style={{ fontSize: 11, color: '#64748b' }}>{notifications.length}</span>
          )}
        </button>

        {/* 8 Main Navigation Items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'HOME',     icon: '📊', label: 'Dashboard' },
            { id: 'OWNERS',   icon: '🏢', label: 'Owners', badge: tenants.length },
            { id: 'BUSES',    icon: '🚌', label: 'Buses', badge: buses.length },
            { id: 'STAFF',    icon: '👥', label: 'Staff', badge: staff.length },
            { id: 'ROUTES',   icon: '🗺️', label: 'Routes', inactive: true, badgeText: 'Inactive' },
            { id: 'TRIPS',    icon: '🕒', label: 'Trips' },
            { id: 'REQUESTS', icon: '📩', label: 'Requests', badge: requests.filter((r) => r.status === 'PENDING').length, badgeColor: '#f59e0b' },
            { id: 'PROFILE',  icon: '👤', label: 'Profile' },
          ].map((item) => {
            const isInactive = !!(item as any).inactive;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isInactive}
                onClick={() => {
                  if (isInactive) return;
                  setActiveTab(item.id as SuperAdminNavTab);
                  setIsMobileNavOpen(false);
                  if (item.id === 'OWNERS') setSelectedOwnerId(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 14px',
                  borderRadius: 12,
                  backgroundColor: isActive ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                  border: isActive ? '1px solid #a855f7' : '1px solid transparent',
                  color: isInactive ? '#64748b' : isActive ? '#c084fc' : '#cbd5e1',
                  fontSize: '0.94rem',
                  fontWeight: isActive ? 800 : 600,
                  cursor: isInactive ? 'not-allowed' : 'pointer',
                  opacity: isInactive ? 0.5 : 1,
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {(item as any).badgeText ? (
                  <span style={{ background: 'rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                    {(item as any).badgeText}
                  </span>
                ) : item.badge !== undefined && item.badge > 0 ? (
                  <span style={{ background: item.badgeColor || 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 9999 }}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Super Admin User Profile Card & Sign Out */}
        <div style={{ paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#4c1d95', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, border: '1px solid rgba(168, 85, 247, 0.4)' }}>
              SA
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.fullName || 'State Super Admin'}
              </div>
              <div style={{ fontSize: 11, color: '#a855f7' }}>
                Full System Oversight
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
          icon="⚡"
          roleBadge="SUPER ADMIN"
          roleBadgeColor="#c084fc"
          roleBadgeBg="rgba(168, 85, 247, 0.2)"
          portalTitle="Super Admin Console"
          portalSubtitle="Statewide Multi-Tenant Fleet & Oversight"
          activeViewTitle={
            activeTab === 'HOME'
              ? 'System Overview'
              : activeTab === 'OWNERS'
              ? `Fleet Owners (${tenants.length})`
              : activeTab === 'BUSES'
              ? `Central Fleet Management (${buses.length})`
              : activeTab === 'STAFF'
              ? `Central Staff Registry (${staff.length})`
              : activeTab === 'ROUTES'
              ? 'Routes (Inactive)'
              : activeTab === 'TRIPS'
              ? 'All Active Trips'
              : activeTab === 'REQUESTS'
              ? `Allocation Requests (${requests.length})`
              : 'Super Admin Security'
          }
          isMobileNavOpen={isMobileNavOpen}
          onToggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
          unreadNotifsCount={unreadNotifsCount}
          onOpenNotifs={() => setIsNotifsOpen(true)}
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
        {/* ══ 1. DASHBOARD OVERVIEW (SYSTEM-WIDE COUNTS ONLY - NO REVENUE) ══ */}
        {activeTab === 'HOME' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1080 }}>
            <div className="page-view-header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  System Operations Overview
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  Statewide multi-tenant fleet oversight, registered operators, and vehicle allocation
                </p>
              </div>
            </div>

            {/* System-Wide Counts Cards (NO REVENUE DISPLAYED) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(168, 85, 247, 0.3)', padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#c084fc', textTransform: 'uppercase' }}>TOTAL OWNERS</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ffffff', marginTop: 4 }}>{tenants.length}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Registered Bus Companies</div>
              </div>

              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(0, 212, 136, 0.3)', padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#00D488', textTransform: 'uppercase' }}>TOTAL BUSES</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#00D488', marginTop: 4 }}>{buses.length}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{buses.filter(b => b.status === 'RUNNING').length} Live on Corridors</div>
              </div>

              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(56, 189, 248, 0.3)', padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>TOTAL DRIVERS</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#38bdf8', marginTop: 4 }}>
                  {staff.filter(s => s.role === 'Driver').length}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Authorized Commercial Drivers</div>
              </div>

              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(245, 158, 11, 0.3)', padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>TOTAL CONDUCTORS</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                  {staff.filter(s => s.role === 'Conductor').length}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Handheld POS Conductors</div>
              </div>

              <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 18, border: '1px solid rgba(225, 29, 72, 0.3)', padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#fca5a5', textTransform: 'uppercase' }}>PENDING REQUESTS</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: '#fca5a5', marginTop: 4 }}>
                  {requests.filter((r) => r.status === 'PENDING').length}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Bus Allocations Awaiting Review</div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('OWNERS');
                  setIsAddOwnerOpen(true);
                }}
                style={{
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)',
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
                <span>Add New Owner / Operator</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBusTargetTenantId(tenants[0]?.id || 'a54b0153-8246-4f88-bba9-7ef85b51a6ed');
                  setBusError(null);
                  setIsAddBusOpen(true);
                }}
                style={{
                  padding: '12px 20px',
                  background: 'rgba(0, 212, 136, 0.15)',
                  border: '1px solid #00D488',
                  color: '#00D488',
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>+</span>
                <span>Register Bus to Owner</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('REQUESTS')}
                style={{
                  padding: '12px 20px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid #f59e0b',
                  color: '#f59e0b',
                  fontSize: 13,
                  fontWeight: 800,
                  borderRadius: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>📩</span>
                <span>Review Bus Requests ({requests.filter((r) => r.status === 'PENDING').length})</span>
              </button>
            </div>

            {/* Operator Summary List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 16, color: '#ffffff' }}>Registered Transport Companies ({tenants.length})</strong>
                <button
                  type="button"
                  onClick={() => setActiveTab('OWNERS')}
                  style={{ background: 'none', border: 'none', color: '#c084fc', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  View All Owners ➔
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                {tenants.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedOwnerId(t.id);
                      setActiveTab('OWNERS');
                    }}
                    style={{
                      background: 'rgba(10, 16, 26, 0.85)',
                      borderRadius: 16,
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '18px 20px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      transition: 'border 0.2s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a855f7')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong style={{ fontSize: 15, color: '#ffffff' }}>{t.companyName}</strong>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Owner: {t.ownerName} ({t.phone})</div>
                      </div>
                      <span style={{ background: t.status === 'ACTIVE' ? 'rgba(0, 212, 136, 0.15)' : 'rgba(225, 29, 72, 0.15)', color: t.status === 'ACTIVE' ? '#00D488' : '#fca5a5', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                        {t.status}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                      Corridor: <strong>{t.corridor}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 4, fontSize: 12 }}>
                      <span style={{ color: '#00D488' }}>🚌 {t.busesCount} Buses</span>
                      <span style={{ color: '#38bdf8' }}>👥 {t.staffCount} Staff</span>
                      <span style={{ color: '#c084fc', fontWeight: 700 }}>Manage ➔</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ 2. OWNERS TAB & STEP-BY-STEP DETAIL VIEW ══ */}
        {activeTab === 'OWNERS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            {/* If NO owner selected: Show All Owners Table/Cards */}
            {!selectedOwnerId ? (
              <>
                <div className="page-view-header">
                  <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                      Registered Fleet Owners ({tenants.length})
                    </h1>
                    <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                      Manage transport company accounts, allocate fleet vehicles, and authorize staff
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAddOwnerOpen(true)}
                    style={{
                      padding: '12px 22px',
                      background: 'linear-gradient(135deg, #a855f7 0%, #6b21a8 100%)',
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: 800,
                      borderRadius: 12,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 16px rgba(168,85,247,0.35)',
                    }}
                  >
                    <span>+</span>
                    <span>Add New Owner</span>
                  </button>
                </div>

                {/* Owner Creation Success Confirmation Modal */}
                {createdOwnerSuccess && (
                  <div
                    style={{
                      background: isLight ? '#f0fdf4' : 'rgba(6, 78, 59, 0.25)',
                      border: '1.5px solid #00D488',
                      borderRadius: 18,
                      padding: 22,
                      boxShadow: '0 12px 30px rgba(0, 212, 136, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 22 }}>✅</span>
                        <strong style={{ fontSize: 17, color: isLight ? '#15803d' : '#00D488' }}>
                          Transport Created Successfully
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreatedOwnerSuccess(null)}
                        style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
                        gap: 12,
                        background: isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.35)',
                        padding: 16,
                        borderRadius: 12,
                        border: `1px solid ${isLight ? '#bbf7d0' : 'rgba(0, 212, 136, 0.2)'}`,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8' }}>TRANSPORT</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{createdOwnerSuccess.companyName}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8' }}>OWNER</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{createdOwnerSuccess.ownerName}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8' }}>ROLE</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#a855f7', marginTop: 2 }}>{createdOwnerSuccess.role}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8' }}>USERNAME</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isLight ? '#0f172a' : '#ffffff', marginTop: 2 }}>{createdOwnerSuccess.username}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8' }}>ACCOUNT ID</div>
                        <div style={{ fontSize: 12, color: isLight ? '#475569' : '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>{createdOwnerSuccess.accountId}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#64748b' : '#94a3b8' }}>SMS STATUS</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: createdOwnerSuccess.smsSent ? (isLight ? '#15803d' : '#00D488') : '#f59e0b', marginTop: 2 }}>
                          {createdOwnerSuccess.smsStatus}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setCreatedOwnerSuccess(null)}
                        style={{
                          padding: '8px 20px',
                          background: '#00D488',
                          color: '#000000',
                          fontSize: 13,
                          fontWeight: 800,
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* Add Owner Modal */}
                {isAddOwnerOpen && (
                  <div style={{ background: 'rgba(10, 18, 26, 0.98)', border: '1.5px solid #a855f7', borderRadius: 20, padding: 24, boxShadow: '0 20px 45px rgba(0,0,0,0.8)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <strong style={{ fontSize: 17, color: '#c084fc' }}>Register New Transport Company & Owner Account</strong>
                      <button type="button" onClick={() => { setIsAddOwnerOpen(false); setOwnerError(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
                    </div>

                    {ownerError && (
                      <div
                        style={{
                          padding: '12px 16px',
                          marginBottom: 14,
                          background: 'rgba(225, 29, 72, 0.15)',
                          border: '1px solid rgba(225, 29, 72, 0.5)',
                          borderRadius: 10,
                          color: '#f87171',
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span>⚠️</span>
                        <span>{ownerError}</span>
                      </div>
                    )}

                    <form onSubmit={handleCreateOwner} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>COMPANY / TENANT NAME *</label>
                          <input type="text" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="e.g. Utkal Royal Transport" required style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>OWNER FULL NAME *</label>
                          <input type="text" value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} placeholder="e.g. Ramesh Chandra Das" required style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }} />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>MOBILE NUMBER (FOR LOGIN) *</label>
                          <input type="tel" value={newOwnerPhone} onChange={(e) => setNewOwnerPhone(e.target.value)} placeholder="10-digit mobile number" required style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>EMAIL ADDRESS *</label>
                          <input type="email" value={newOwnerEmail} onChange={(e) => setNewOwnerEmail(e.target.value)} placeholder="owner@company.com" required style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }} />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>INITIAL PASSWORD (FOR OWNER LOGIN) *</label>
                          <input
                            type="password"
                            value={newOwnerPassword}
                            onChange={(e) => setNewOwnerPassword(e.target.value)}
                            placeholder="Minimum 8 characters"
                            required
                            minLength={8}
                            style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>PRIMARY OPERATING CORRIDOR</label>
                          <input type="text" value={newOwnerCorridor} onChange={(e) => setNewOwnerCorridor(e.target.value)} placeholder="e.g. Origin ↔ Destination" style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button
                          type="submit"
                          disabled={isSubmittingOwner}
                          style={{
                            flex: 1,
                            padding: '13px',
                            background: isSubmittingOwner ? 'rgba(168, 85, 247, 0.4)' : '#a855f7',
                            color: '#ffffff',
                            fontWeight: 900,
                            borderRadius: 12,
                            border: 'none',
                            cursor: isSubmittingOwner ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isSubmittingOwner ? 'Provisioning Account in PostgreSQL...' : 'Create Company Account & Authorize Owner'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsAddOwnerOpen(false); setOwnerError(null); }}
                          style={{
                            padding: '13px 20px',
                            background: 'rgba(255,255,255,0.08)',
                            color: '#cbd5e1',
                            fontWeight: 700,
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.1)',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}


                {/* Owners Table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {tenants.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                        borderRadius: 18,
                        border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                        padding: '20px 24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 16,
                        boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <strong style={{ fontSize: 17, color: isLight ? '#0f172a' : '#ffffff' }}>{t.companyName}</strong>
                          <span style={{ background: t.status === 'ACTIVE' ? (isLight ? '#dcfce7' : 'rgba(0, 212, 136, 0.15)') : (isLight ? '#fee2e2' : 'rgba(225, 29, 72, 0.15)'), color: t.status === 'ACTIVE' ? (isLight ? '#15803d' : '#00D488') : '#e11d48', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                            {t.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: isLight ? '#334155' : '#cbd5e1', marginTop: 4 }}>
                          Owner: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{t.ownerName}</strong> · Mobile: <span style={{ color: isLight ? '#0f172a' : '#ffffff', fontWeight: 700 }}>{t.phone}</span> · Corridor: <span style={{ color: isLight ? '#047857' : '#00D488', fontWeight: 800 }}>{t.corridor}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ textAlign: 'right', fontSize: 13 }}>
                          <div><strong style={{ color: isLight ? '#047857' : '#00D488' }}>{t.busesCount}</strong> <span style={{ color: isLight ? '#334155' : '#cbd5e1' }}>Buses</span></div>
                          <div style={{ color: isLight ? '#334155' : '#cbd5e1' }}><strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{t.staffCount}</strong> Staff</div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOwnerId(t.id);
                            setOwnerDetailStep(1);
                            const mainEl = document.querySelector('.passenger-main');
                            if (mainEl) mainEl.scrollTop = 0;
                          }}
                          style={{
                            padding: '10px 18px',
                            background: isLight ? '#f5f3ff' : 'rgba(168, 85, 247, 0.15)',
                            border: `1px solid ${isLight ? '#c084fc' : '#a855f7'}`,
                            color: isLight ? '#7e22ce' : '#c084fc',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: isLight ? '0 2px 6px rgba(126, 34, 206, 0.12)' : 'none',
                          }}
                        >
                          Step-by-Step Manage ➔
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* ── STEP-BY-STEP DETAIL VIEW FOR SELECTED OWNER ── */
              selectedTenant && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 4 }}>
                  {/* Header with Back Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOwnerId(null);
                          const mainEl = document.querySelector('.passenger-main');
                          if (mainEl) mainEl.scrollTop = 0;
                        }}
                        style={{
                          background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.08)',
                          border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)'}`,
                          color: isLight ? '#0f172a' : '#ffffff',
                          padding: '6px 14px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <span>←</span>
                        <span>Back to All Owners</span>
                      </button>
                      <h1 style={{ fontSize: 'clamp(1.4rem, 5vw, 1.85rem)', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0, letterSpacing: -0.5 }}>
                        {selectedTenant.companyName}
                      </h1>
                      <div style={{ fontSize: 13, color: isLight ? '#6b21a8' : '#c084fc', marginTop: 4, fontWeight: 700 }}>
                        Owner: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{selectedTenant.ownerName}</strong> · Mobile: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{selectedTenant.phone}</strong> · Corridor: <strong style={{ color: isLight ? '#047857' : '#00D488' }}>{selectedTenant.corridor}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleOwnerStatus(selectedTenant.id, selectedTenant.status)}
                      style={{
                        padding: '9px 18px',
                        background: selectedTenant.status === 'ACTIVE'
                          ? (isLight ? '#fee2e2' : 'rgba(225, 29, 72, 0.15)')
                          : (isLight ? '#dcfce7' : 'rgba(0, 212, 136, 0.15)'),
                        border: `1px solid ${selectedTenant.status === 'ACTIVE' ? (isLight ? '#fca5a5' : '#e11d48') : (isLight ? '#86efac' : '#00D488')}`,
                        color: selectedTenant.status === 'ACTIVE' ? '#b91c1c' : (isLight ? '#15803d' : '#00D488'),
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {selectedTenant.status === 'ACTIVE' ? 'Deactivate Company' : 'Activate Company'}
                    </button>
                  </div>

                  {/* 6 Step Navigation Pills */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      background: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.7)',
                      border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                      padding: '8px 10px',
                      borderRadius: 14,
                      overflowX: 'auto',
                      WebkitOverflowScrolling: 'touch',
                      width: '100%',
                      boxSizing: 'border-box',
                      boxShadow: isLight ? '0 2px 8px rgba(15, 23, 42, 0.04)' : 'none',
                    }}
                  >
                    {[
                      { step: 1, label: '1. Company Details' },
                      { step: 2, label: `2. Buses (${selectedTenantBuses.length})` },
                      { step: 3, label: `3. Drivers (${selectedTenantStaff.filter(s => s.role === 'Driver').length})` },
                      { step: 4, label: `4. Conductors (${selectedTenantStaff.filter(s => s.role === 'Conductor').length})` },
                      { step: 5, label: '5. Routes & Stops' },
                      { step: 6, label: '6. Trips & Live Buses' },
                    ].map((item) => (
                      <button
                        key={item.step}
                        type="button"
                        onClick={() => setOwnerDetailStep(item.step as any)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 10,
                          border: ownerDetailStep === item.step
                            ? 'none'
                            : `1px solid ${isLight ? '#e2e8f0' : 'transparent'}`,
                          backgroundColor: ownerDetailStep === item.step
                            ? '#9333ea'
                            : isLight ? '#f8fafc' : 'transparent',
                          color: ownerDetailStep === item.step
                            ? '#ffffff'
                            : isLight ? '#334155' : '#cbd5e1',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                          boxShadow: ownerDetailStep === item.step
                            ? '0 2px 8px rgba(147, 51, 234, 0.35)'
                            : 'none',
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* STEP 1: COMPANY DETAILS */}
                  {ownerDetailStep === 1 && (
                    <div
                      style={{
                        background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                        borderRadius: 20,
                        border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                        padding: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
                      }}
                    >
                      <strong style={{ fontSize: 16, color: isLight ? '#6b21a8' : '#c084fc', fontWeight: 900 }}>
                        Step 1: Transport Company Profile & Credentials
                      </strong>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14 }}>
                        <div style={{ background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', padding: 14, borderRadius: 12, border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#475569' : '#cbd5e1' }}>COMPANY NAME</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? '#0f172a' : '#fff', marginTop: 2 }}>{selectedTenant.companyName}</div>
                        </div>
                        <div style={{ background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', padding: 14, borderRadius: 12, border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#475569' : '#cbd5e1' }}>OWNER NAME</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? '#0f172a' : '#fff', marginTop: 2 }}>{selectedTenant.ownerName}</div>
                        </div>
                        <div style={{ background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', padding: 14, borderRadius: 12, border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#475569' : '#cbd5e1' }}>REGISTERED MOBILE</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? '#047857' : '#00D488', marginTop: 2 }}>{selectedTenant.phone}</div>
                        </div>
                        <div style={{ background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', padding: 14, borderRadius: 12, border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#475569' : '#cbd5e1' }}>EMAIL ADDRESS</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isLight ? '#0f172a' : '#fff', marginTop: 2 }}>{selectedTenant.email}</div>
                        </div>
                      </div>

                      <div style={{ padding: 14, background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isLight ? '#475569' : '#cbd5e1' }}>ASSIGNED HIGHWAY CORRIDOR</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isLight ? '#0284c7' : '#38bdf8', marginTop: 2 }}>{selectedTenant.corridor}</div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: THEIR BUSES */}
                  {ownerDetailStep === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <strong style={{ fontSize: 16, color: isLight ? '#047857' : '#00D488', fontWeight: 900 }}>
                          Step 2: Fleet Buses for {selectedTenant.companyName} ({selectedTenantBuses.length})
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            setBusTargetTenantId(selectedTenant.id);
                            setBusError(null);
                            setIsAddBusOpen(true);
                          }}
                          style={{ padding: '8px 16px', background: '#00D488', color: '#000', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                        >
                          + Register Bus for this Transport
                        </button>
                      </div>

                      {selectedTenantBuses.length === 0 ? (
                        <div
                          style={{
                            padding: '40px 24px',
                            textAlign: 'center',
                            background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                            borderRadius: 16,
                            border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                            boxShadow: isLight ? '0 4px 14px rgba(0,0,0,0.05)' : 'none',
                          }}
                        >
                          <div style={{ fontSize: 32, marginBottom: 8 }}>🚌</div>
                          <strong style={{ fontSize: 16, color: isLight ? '#0f172a' : '#ffffff', display: 'block' }}>
                            No buses added
                          </strong>
                          <p style={{ fontSize: 13, color: isLight ? '#64748b' : '#94a3b8', marginTop: 6, margin: '6px 0 0 0' }}>
                            No vehicles currently registered for {selectedTenant.companyName}. Use &quot;+ Register Bus for this Transport&quot; above to allocate a real bus.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
                        {selectedTenantBuses.map((b) => (
                          <div
                            key={b.id}
                            style={{
                              background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                              borderRadius: 16,
                              border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                              padding: 18,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <strong style={{ fontSize: 15, color: isLight ? '#0f172a' : '#fff' }}>{b.name}</strong>
                                <div style={{ fontSize: 12, color: isLight ? '#047857' : '#00D488', fontWeight: 800 }}>{b.reg}</div>
                              </div>
                              <span style={{ background: b.status === 'RUNNING' ? (isLight ? '#dcfce7' : 'rgba(0,212,136,0.15)') : (isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)'), color: b.status === 'RUNNING' ? (isLight ? '#15803d' : '#00D488') : (isLight ? '#475569' : '#cbd5e1'), fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                                {b.status}
                              </span>
                            </div>

                            <div style={{ fontSize: 12, color: isLight ? '#334155' : '#cbd5e1' }}>
                              Route: <strong style={{ color: isLight ? '#0f172a' : '#fff' }}>{b.route} ({b.seats} Seats)</strong>
                            </div>
                            <div style={{ fontSize: 12, color: isLight ? '#334155' : '#cbd5e1' }}>
                              Speed: <strong style={{ color: isLight ? '#047857' : '#00D488' }}>{b.speed} km/h</strong> · Driver: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{b.driver}</strong>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteBus(b.id)}
                              style={{ marginTop: 4, width: '100%', padding: '7px', background: isLight ? '#fee2e2' : 'rgba(225,29,72,0.15)', border: `1px solid ${isLight ? '#fca5a5' : 'rgba(225,29,72,0.3)'}`, color: isLight ? '#b91c1c' : '#fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                            >
                              Remove Bus
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                  {/* STEP 3: THEIR DRIVERS */}
                  {ownerDetailStep === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <strong style={{ fontSize: 16, color: isLight ? '#0284c7' : '#38bdf8', fontWeight: 900 }}>
                          Step 3: Drivers for {selectedTenant.companyName}
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            setStaffTargetTenantId(selectedTenant.id);
                            setNewStaffRole('Driver');
                            setIsAddStaffOpen(true);
                          }}
                          style={{ padding: '8px 16px', background: '#0284c7', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                        >
                          + Add Driver
                        </button>
                      </div>

                      {selectedTenantStaff.filter(s => s.role === 'Driver').length === 0 ? (
                        <div style={{ padding: '32px 20px', textAlign: 'center', background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)', borderRadius: 16, border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>
                          <div style={{ fontSize: 24, marginBottom: 6 }}>👨‍✈️</div>
                          <strong style={{ fontSize: 14, color: isLight ? '#0f172a' : '#fff', display: 'block' }}>No drivers provisioned yet</strong>
                          <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', margin: '4px 0 0 0' }}>Use &quot;+ Add Driver&quot; above to allocate drivers to {selectedTenant.companyName}.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
                          {selectedTenantStaff.filter(s => s.role === 'Driver').map((s) => (
                            <div
                              key={s.id}
                              style={{
                                background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                                borderRadius: 16,
                                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                                padding: 16,
                                boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
                              }}
                            >
                              <strong style={{ fontSize: 15, color: isLight ? '#0f172a' : '#fff' }}>{s.name}</strong>
                              <div style={{ fontSize: 12, color: isLight ? '#334155' : '#cbd5e1', marginTop: 2 }}>Phone: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{s.phone}</strong></div>
                              <div style={{ fontSize: 12, color: isLight ? '#0284c7' : '#38bdf8', marginTop: 2, fontWeight: 700 }}>Assigned Bus: {s.bus}</div>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(s.id)}
                                style={{ marginTop: 8, width: '100%', padding: '6px', background: isLight ? '#fee2e2' : 'rgba(225,29,72,0.15)', border: `1px solid ${isLight ? '#fca5a5' : 'rgba(225,29,72,0.3)'}`, color: isLight ? '#b91c1c' : '#fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                              >
                                Remove Driver
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 4: THEIR CONDUCTORS */}
                  {ownerDetailStep === 4 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <strong style={{ fontSize: 16, color: isLight ? '#b45309' : '#f59e0b', fontWeight: 900 }}>
                          Step 4: Conductors for {selectedTenant.companyName}
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            setStaffTargetTenantId(selectedTenant.id);
                            setNewStaffRole('Conductor');
                            setIsAddStaffOpen(true);
                          }}
                          style={{ padding: '8px 16px', background: '#d97706', color: '#fff', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                        >
                          + Add Conductor
                        </button>
                      </div>

                      {selectedTenantStaff.filter(s => s.role === 'Conductor').length === 0 ? (
                        <div style={{ padding: '32px 20px', textAlign: 'center', background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)', borderRadius: 16, border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}` }}>
                          <div style={{ fontSize: 24, marginBottom: 6 }}>🎫</div>
                          <strong style={{ fontSize: 14, color: isLight ? '#0f172a' : '#fff', display: 'block' }}>No conductors provisioned yet</strong>
                          <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', margin: '4px 0 0 0' }}>Use &quot;+ Add Conductor&quot; above to allocate conductors to {selectedTenant.companyName}.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
                          {selectedTenantStaff.filter(s => s.role === 'Conductor').map((s) => (
                            <div
                              key={s.id}
                              style={{
                                background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                                borderRadius: 16,
                                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                                padding: 16,
                                boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
                              }}
                            >
                              <strong style={{ fontSize: 15, color: isLight ? '#0f172a' : '#fff' }}>{s.name}</strong>
                              <div style={{ fontSize: 12, color: isLight ? '#334155' : '#cbd5e1', marginTop: 2 }}>Phone: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{s.phone}</strong></div>
                              <div style={{ fontSize: 12, color: isLight ? '#b45309' : '#f59e0b', marginTop: 2, fontWeight: 700 }}>Assigned Bus: {s.bus}</div>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(s.id)}
                                style={{ marginTop: 8, width: '100%', padding: '6px', background: isLight ? '#fee2e2' : 'rgba(225,29,72,0.15)', border: `1px solid ${isLight ? '#fca5a5' : 'rgba(225,29,72,0.3)'}`, color: isLight ? '#b91c1c' : '#fca5a5', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                              >
                                Remove Conductor
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 5: ROUTES & STOPS */}
                  {ownerDetailStep === 5 && (
                    <div
                      style={{
                        background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                        borderRadius: 20,
                        border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                        padding: 22,
                        boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
                      }}
                    >
                      <strong style={{ fontSize: 16, color: isLight ? '#6b21a8' : '#c084fc', fontWeight: 900 }}>
                        Step 5: Assigned Corridor Routes & Stop Network
                      </strong>
                      <p style={{ fontSize: 13, color: isLight ? '#334155' : '#cbd5e1', marginTop: 4, fontWeight: 600 }}>
                        Corridor: <strong style={{ color: isLight ? '#047857' : '#00D488' }}>{selectedTenant.corridor}</strong>
                      </p>
                      {selectedTenantBuses.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.5)', borderRadius: 12, border: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, marginTop: 14 }}>
                          <div style={{ fontSize: 24, marginBottom: 6 }}>🗺️</div>
                          <strong style={{ fontSize: 14, color: isLight ? '#0f172a' : '#fff', display: 'block' }}>No corridor routes or stoppages configured yet</strong>
                          <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', margin: '4px 0 0 0' }}>Route allocation and stoppage schedules are configured when fleet buses are registered for this transport.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                          {stops.map((s) => (
                            <span
                              key={s.id}
                              style={{
                                padding: '8px 14px',
                                background: isLight ? '#f1f5f9' : 'rgba(15, 23, 42, 0.8)',
                                border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 10,
                                fontSize: 12,
                                fontWeight: 700,
                                color: isLight ? '#0f172a' : '#ffffff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                              }}
                            >
                              <span style={{ color: isLight ? '#047857' : '#00D488' }}>📍</span>
                              <span>{s.name}</span>
                              <span style={{ fontSize: 11, color: isLight ? '#475569' : '#cbd5e1', fontWeight: 600 }}>
                                ({s.km} km)
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}


                  {/* STEP 6: TRIPS & LIVE BUSES */}
                  {ownerDetailStep === 6 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <strong style={{ fontSize: 16, color: isLight ? '#047857' : '#00D488', fontWeight: 900 }}>
                        Step 6: Live Radar Tracking for {selectedTenant.companyName}
                      </strong>
                    {fleetMarkers.filter(m => selectedTenantBuses.some(b => b.id === m.id)).length > 0 ? (
                      <div style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(0, 212, 136, 0.3)'}` }}>
                        <GoogleMapView
                          center={{
                            lat: fleetMarkers.filter(m => selectedTenantBuses.some(b => b.id === m.id))[0].lat,
                            lng: fleetMarkers.filter(m => selectedTenantBuses.some(b => b.id === m.id))[0].lng,
                          }}
                          zoom={10}
                          height={460}
                          markers={fleetMarkers.filter(m => selectedTenantBuses.some(b => b.id === m.id))}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 240,
                          borderRadius: 20,
                          border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isLight ? '#64748b' : '#94a3b8',
                          gap: 8,
                        }}
                      >
                        <span style={{ fontSize: 28 }}>📡</span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>No live GPS data</span>
                        <span style={{ fontSize: 11, color: isLight ? '#94a3b8' : '#64748b' }}>Waiting for vehicle telemetry</span>
                      </div>
                    )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* ══ 3. BUSES TAB (TRANSPORT-WISE FLEET MANAGEMENT) ══ */}
        {activeTab === 'BUSES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1080 }}>
            <div className="page-view-header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  Central Fleet Management ({buses.length})
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  All registered buses organized transport-wise by fleet operator
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setBusTargetTenantId(tenants[0]?.id || 'a54b0153-8246-4f88-bba9-7ef85b51a6ed');
                  setBusError(null);
                  setIsAddBusOpen(true);
                }}
                style={{
                  padding: '12px 20px',
                  background: '#00B87A',
                  color: '#fff',
                  borderRadius: 12,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: isLight ? '0 2px 8px rgba(0, 184, 122, 0.25)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>+</span>
                <span>Register & Assign Bus</span>
              </button>
            </div>

            {/* Transport-Wise Bus Cards */}
            {tenants.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                  borderRadius: 16,
                  border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: isLight ? '0 4px 14px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
                <strong style={{ fontSize: 16, color: isLight ? '#0f172a' : '#ffffff', display: 'block' }}>
                  No transport operators registered
                </strong>
                <p style={{ fontSize: 13, color: isLight ? '#64748b' : '#94a3b8', marginTop: 6, margin: '6px 0 0 0' }}>
                  Add a Transport Owner in the Owners section first to begin registering and assigning buses.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {tenants.map((t) => {
                  const tenantBuses = buses.filter((b) => b.tenantId === t.id || b.tenantName === t.companyName);
                  return (
                    <div
                      key={t.id}
                      className="transport-group-card"
                      style={{
                        background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                        borderRadius: 20,
                        border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                        padding: '22px 24px',
                        boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                      }}
                    >
                      {/* Transport Card Header */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          borderBottom: `1px solid ${isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)'}`,
                          paddingBottom: 14,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 20 }}>🏢</span>
                            <strong style={{ fontSize: 18, color: isLight ? '#0f172a' : '#ffffff', fontWeight: 900 }}>
                              {t.companyName}
                            </strong>
                            <span
                              style={{
                                background: t.status === 'ACTIVE'
                                  ? (isLight ? '#dcfce7' : 'rgba(0, 212, 136, 0.15)')
                                  : (isLight ? '#fee2e2' : 'rgba(225, 29, 72, 0.15)'),
                                color: t.status === 'ACTIVE'
                                  ? (isLight ? '#15803d' : '#00D488')
                                  : '#e11d48',
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}
                            >
                              {t.status || 'ACTIVE'}
                            </span>
                            <span
                              style={{
                                background: isLight ? '#f3e8ff' : 'rgba(168, 85, 247, 0.15)',
                                color: isLight ? '#7e22ce' : '#c084fc',
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '3px 10px',
                                borderRadius: 9999,
                              }}
                            >
                              {tenantBuses.length} {tenantBuses.length === 1 ? 'Bus' : 'Buses'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                            Owner: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{t.ownerName}</strong> · Mobile: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{t.phone}</strong> · Corridor: <strong style={{ color: isLight ? '#059669' : '#00D488' }}>{t.corridor || 'Assigned Transit Corridor'}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setBusTargetTenantId(t.id);
                            setBusError(null);
                            setIsAddBusOpen(true);
                          }}
                          style={{
                            padding: '9px 16px',
                            background: isLight ? '#ecfdf5' : 'rgba(0, 212, 136, 0.15)',
                            border: `1px solid ${isLight ? '#a7f3d0' : 'rgba(0, 212, 136, 0.4)'}`,
                            color: isLight ? '#047857' : '#00D488',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span>+</span>
                          <span>Register Bus for this Transport</span>
                        </button>
                      </div>

                      {/* Buses Inside This Transport */}
                      {tenantBuses.length === 0 ? (
                        <div
                          style={{
                            padding: '28px 16px',
                            textAlign: 'center',
                            background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)',
                            borderRadius: 14,
                            border: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          <div style={{ fontSize: 26, marginBottom: 4 }}>🚌</div>
                          <strong style={{ fontSize: 14, color: isLight ? '#0f172a' : '#ffffff', display: 'block' }}>
                            No buses registered for {t.companyName} yet
                          </strong>
                          <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', margin: '4px 0 0 0' }}>
                            Click &quot;+ Register Bus for this Transport&quot; above to allocate a vehicle to this fleet operator.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))', gap: 14 }}>
                          {tenantBuses.map((b) => (
                            <div
                              key={b.id}
                              style={{
                                background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.7)',
                                borderRadius: 14,
                                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                                padding: 16,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.03)' : 'none',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: 16, color: isLight ? '#059669' : '#00D488', letterSpacing: 0.5 }}>{b.reg}</strong>
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: b.status === 'RUNNING' ? (isLight ? '#15803d' : '#00D488') : (isLight ? '#475569' : '#cbd5e1'),
                                    fontWeight: 800,
                                    background: b.status === 'RUNNING' ? (isLight ? '#dcfce7' : 'rgba(0,212,136,0.15)') : (isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'),
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                  }}
                                >
                                  {b.status || 'AVAILABLE'}
                                </span>
                              </div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: isLight ? '#0f172a' : '#ffffff' }}>{b.name}</div>
                              <div style={{ fontSize: 12, color: isLight ? '#475569' : '#94a3b8' }}>
                                Route: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{b.route || 'Assigned Transit Corridor'} ({b.seats || 40} Seats)</strong>
                              </div>
                              <div style={{ fontSize: 11, color: isLight ? '#334155' : '#cbd5e1' }}>
                                Driver: <strong>{b.driver || 'Unassigned'}</strong> · Conductor: <strong>{b.conductor || 'Unassigned'}</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteBus(b.id)}
                                style={{
                                  marginTop: 6,
                                  padding: '7px',
                                  background: isLight ? '#fee2e2' : 'rgba(225,29,72,0.12)',
                                  border: `1px solid ${isLight ? '#fca5a5' : 'rgba(225,29,72,0.25)'}`,
                                  color: isLight ? '#b91c1c' : '#fca5a5',
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease',
                                }}
                              >
                                Delete Bus
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ 4. STAFF TAB (TRANSPORT-WISE STAFF REGISTRY) ══ */}
        {activeTab === 'STAFF' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1080 }}>
            <div className="page-view-header">
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: isLight ? '#0f172a' : '#ffffff', margin: 0 }}>
                  Central Staff Registry ({staff.length})
                </h1>
                <p style={{ fontSize: 14, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                  All certified drivers & conductors organized transport-wise by fleet operator
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStaffTargetTenantId(tenants[0]?.id || 'a54b0153-8246-4f88-bba9-7ef85b51a6ed');
                  setIsAddStaffOpen(true);
                }}
                style={{
                  padding: '12px 20px',
                  background: '#0284c7',
                  color: '#fff',
                  borderRadius: 12,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: isLight ? '0 2px 8px rgba(2, 132, 199, 0.25)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>+</span>
                <span>Add Staff Member</span>
              </button>
            </div>

            {/* Add Staff Modal */}
            {isAddStaffOpen && (
              <div
                style={{
                  background: isLight ? '#ffffff' : 'rgba(10, 18, 26, 0.98)',
                  border: `1.5px solid ${isLight ? '#cbd5e1' : '#38bdf8'}`,
                  borderRadius: 20,
                  padding: 24,
                  boxShadow: isLight ? '0 20px 45px rgba(15, 23, 42, 0.15)' : '0 20px 45px rgba(0,0,0,0.8)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <strong style={{ fontSize: 17, color: isLight ? '#0284c7' : '#38bdf8' }}>Register Staff & Assign to Operator</strong>
                  <button type="button" onClick={() => setIsAddStaffOpen(false)} style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>

                <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 4 }}>ASSIGN TO OPERATOR</label>
                      <select value={staffTargetTenantId} onChange={(e) => setStaffTargetTenantId(e.target.value)} style={{ width: '100%', padding: '11px 14px', background: isLight ? '#f8fafc' : '#050a0f', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none' }}>
                        {tenants.map((t) => (
                          <option key={t.id} value={t.id} style={{ background: isLight ? '#ffffff' : '#050a0f', color: isLight ? '#0f172a' : '#ffffff' }}>{t.companyName}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 4 }}>STAFF ROLE</label>
                      <select value={newStaffRole} onChange={(e) => setNewStaffRole(e.target.value as any)} style={{ width: '100%', padding: '11px 14px', background: isLight ? '#f8fafc' : '#050a0f', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none' }}>
                        <option value="Driver" style={{ background: isLight ? '#ffffff' : '#050a0f', color: isLight ? '#0f172a' : '#ffffff' }}>Driver</option>
                        <option value="Conductor" style={{ background: isLight ? '#ffffff' : '#050a0f', color: isLight ? '#0f172a' : '#ffffff' }}>Conductor</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 4 }}>FULL NAME</label>
                      <input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="e.g. Ramesh Singh" required style={{ width: '100%', padding: '11px 14px', background: isLight ? '#f8fafc' : 'rgba(5,10,15,0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 4 }}>MOBILE NUMBER</label>
                      <input type="tel" value={newStaffPhone} onChange={(e) => setNewStaffPhone(e.target.value)} placeholder="10-digit mobile" required style={{ width: '100%', padding: '11px 14px', background: isLight ? '#f8fafc' : 'rgba(5,10,15,0.8)', border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, color: isLight ? '#0f172a' : '#ffffff', outline: 'none' }} />
                    </div>
                  </div>

                  <button type="submit" style={{ padding: '13px', background: '#0284c7', color: '#fff', fontWeight: 900, borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                    Save Staff Member
                  </button>
                </form>
              </div>
            )}

            {/* Transport-Wise Staff Cards */}
            {tenants.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                  borderRadius: 16,
                  border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: isLight ? '0 4px 14px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                <strong style={{ fontSize: 16, color: isLight ? '#0f172a' : '#ffffff', display: 'block' }}>
                  No transport operators registered
                </strong>
                <p style={{ fontSize: 13, color: isLight ? '#64748b' : '#94a3b8', marginTop: 6, margin: '6px 0 0 0' }}>
                  Add a Transport Owner first to manage certified drivers and conductors.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {tenants.map((t) => {
                  const tenantStaff = staff.filter((s) => s.tenantId === t.id || s.tenantName === t.companyName);
                  return (
                    <div
                      key={t.id}
                      className="transport-group-card"
                      style={{
                        background: isLight ? '#ffffff' : 'rgba(10, 16, 26, 0.85)',
                        borderRadius: 20,
                        border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}`,
                        padding: '22px 24px',
                        boxShadow: isLight ? '0 4px 16px -2px rgba(15, 23, 42, 0.05)' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                      }}
                    >
                      {/* Transport Card Header */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 12,
                          borderBottom: `1px solid ${isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.06)'}`,
                          paddingBottom: 14,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 20 }}>🏢</span>
                            <strong style={{ fontSize: 18, color: isLight ? '#0f172a' : '#ffffff', fontWeight: 900 }}>
                              {t.companyName}
                            </strong>
                            <span
                              style={{
                                background: t.status === 'ACTIVE'
                                  ? (isLight ? '#dcfce7' : 'rgba(0, 212, 136, 0.15)')
                                  : (isLight ? '#fee2e2' : 'rgba(225, 29, 72, 0.15)'),
                                color: t.status === 'ACTIVE'
                                  ? (isLight ? '#15803d' : '#00D488')
                                  : '#e11d48',
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}
                            >
                              {t.status || 'ACTIVE'}
                            </span>
                            <span
                              style={{
                                background: isLight ? '#e0f2fe' : 'rgba(2, 132, 199, 0.15)',
                                color: isLight ? '#0284c7' : '#38bdf8',
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '3px 10px',
                                borderRadius: 9999,
                              }}
                            >
                              {tenantStaff.length} {tenantStaff.length === 1 ? 'Staff Member' : 'Staff Members'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: isLight ? '#475569' : '#94a3b8', marginTop: 4 }}>
                            Transport Owner: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{t.ownerName}</strong> · Mobile: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{t.phone}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setStaffTargetTenantId(t.id);
                            setIsAddStaffOpen(true);
                          }}
                          style={{
                            padding: '9px 16px',
                            background: isLight ? '#f0f9ff' : 'rgba(2, 132, 199, 0.15)',
                            border: `1px solid ${isLight ? '#bae6fd' : 'rgba(2, 132, 199, 0.4)'}`,
                            color: isLight ? '#0284c7' : '#38bdf8',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span>+</span>
                          <span>Add Staff to this Transport</span>
                        </button>
                      </div>

                      {/* Staff Inside This Transport */}
                      {tenantStaff.length === 0 ? (
                        <div
                          style={{
                            padding: '28px 16px',
                            textAlign: 'center',
                            background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.4)',
                            borderRadius: 14,
                            border: `1px dashed ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.1)'}`,
                          }}
                        >
                          <div style={{ fontSize: 26, marginBottom: 4 }}>👤</div>
                          <strong style={{ fontSize: 14, color: isLight ? '#0f172a' : '#ffffff', display: 'block' }}>
                            No certified drivers or conductors registered for {t.companyName} yet
                          </strong>
                          <p style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', margin: '4px 0 0 0' }}>
                            Click &quot;+ Add Staff to this Transport&quot; above to register drivers or conductors for this operator.
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 14 }}>
                          {tenantStaff.map((s) => (
                            <div
                              key={s.id}
                              style={{
                                background: isLight ? '#f8fafc' : 'rgba(15, 23, 42, 0.7)',
                                borderRadius: 14,
                                border: `1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
                                padding: 16,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                                boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.03)' : 'none',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: 15, color: isLight ? '#0f172a' : '#ffffff' }}>{s.name}</strong>
                                <span
                                  style={{
                                    background: s.role === 'Driver'
                                      ? (isLight ? '#e0f2fe' : 'rgba(56,189,248,0.2)')
                                      : (isLight ? '#fef3c7' : 'rgba(245,158,11,0.2)'),
                                    color: s.role === 'Driver'
                                      ? (isLight ? '#0284c7' : '#38bdf8')
                                      : (isLight ? '#d97706' : '#f59e0b'),
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                  }}
                                >
                                  {s.role}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: isLight ? '#475569' : '#94a3b8' }}>
                                Mobile: <strong style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{s.phone}</strong>
                              </div>
                              <div style={{ fontSize: 12, color: isLight ? '#047857' : '#00D488', fontWeight: 600 }}>
                                Assigned Bus: <strong>{s.bus || 'None (Available)'}</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(s.id)}
                                style={{
                                  marginTop: 6,
                                  padding: '7px',
                                  background: isLight ? '#fee2e2' : 'rgba(225,29,72,0.12)',
                                  border: `1px solid ${isLight ? '#fca5a5' : 'rgba(225,29,72,0.25)'}`,
                                  color: isLight ? '#b91c1c' : '#fca5a5',
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'background 0.15s ease',
                                }}
                              >
                                Remove Staff
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ 5. ROUTES TAB (INACTIVE FOR REAL-TIME PRODUCTION TESTING) ══ */}
        {activeTab === 'ROUTES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 20, border: '1px solid rgba(255, 255, 255, 0.08)', padding: 36, textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🗺️</div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Routes Menu Inactive
              </h2>
              <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 540, margin: '10px auto 20px', lineHeight: 1.6 }}>
                Master transit corridor route editing is currently inactive in the Super Admin console during production testing. Highway routes and stoppage checkpoints are managed per fleet operator.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('HOME')}
                style={{ padding: '10px 22px', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', color: '#fff', fontWeight: 800, borderRadius: 10, border: 'none', cursor: 'pointer' }}
              >
                Back to Dashboard Overview
              </button>
            </div>
          </div>
        )}

        {/* ══ 6. TRIPS TAB ══ */}
        {activeTab === 'TRIPS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1080 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Live Trip Monitoring & GPS Radar
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                Real-time tracking of active fleet operations across all operators
              </p>
            </div>

            {fleetMarkers.length > 0 ? (
              <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(0, 212, 136, 0.3)', boxShadow: '0 20px 45px rgba(0,0,0,0.6)' }}>
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
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  gap: 10,
                  background: 'rgba(5, 10, 15, 0.6)',
                }}
              >
                <span style={{ fontSize: 36 }}>📡</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>No live GPS data</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>Waiting for vehicle telemetry</span>
              </div>
            )}
          </div>
        )}

        {/* ══ 7. REQUESTS TAB (BUS ACQUISITION REQUESTS FROM OWNERS) ══ */}
        {activeTab === 'REQUESTS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Fleet Acquisition Requests ({requests.length})
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                Review requests submitted by fleet owners. Approve to immediately create and assign the requested vehicle.
              </p>
            </div>

            {/* Approve Modal */}
            {isApproveModalOpen && (
              <div style={{ background: 'rgba(10, 18, 26, 0.98)', border: '1.5px solid #00D488', borderRadius: 20, padding: 24, boxShadow: '0 20px 45px rgba(0,0,0,0.8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <strong style={{ fontSize: 17, color: '#00D488' }}>Approve Request & Issue Registration Number</strong>
                  <button type="button" onClick={() => setIsApproveModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}>✕</button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (selectedRequestId) handleApproveBusRequest(selectedRequestId);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>ASSIGN OFFICIAL REGISTRATION NUMBER</label>
                    <input type="text" value={approvedBusReg} onChange={(e) => setApprovedBusReg(e.target.value)} placeholder="e.g. RB-01-H-1144" required style={{ width: '100%', padding: '11px 14px', background: 'rgba(5,10,15,0.8)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#ffffff', outline: 'none' }} />
                  </div>
                  <button type="submit" style={{ padding: '13px', background: '#00B87A', color: '#fff', fontWeight: 900, borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                    Confirm Approval & Create Bus in Fleet
                  </button>
                </form>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {requests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    background: 'rgba(10, 16, 26, 0.85)',
                    borderRadius: 18,
                    border: req.status === 'PENDING' ? '1.5px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 16, color: '#ffffff' }}>{req.tenantName}</strong>
                        <span style={{ fontSize: 11, color: '#a855f7' }}>({req.ownerName})</span>
                      </div>
                      <div style={{ fontSize: 14, color: '#00D488', fontWeight: 800, marginTop: 2 }}>
                        Requested: {req.requestedModel} ({req.capacity} Seats)
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                        Target Corridor: {req.route} · Submitted: {req.createdAt}
                      </div>
                    </div>

                    <span style={{ background: req.status === 'PENDING' ? 'rgba(245,158,11,0.2)' : req.status === 'APPROVED' ? 'rgba(0,212,136,0.2)' : 'rgba(225,29,72,0.2)', color: req.status === 'PENDING' ? '#f59e0b' : req.status === 'APPROVED' ? '#00D488' : '#fca5a5', fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 6 }}>
                      {req.status}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px 14px', borderRadius: 10, fontSize: 12, color: '#cbd5e1' }}>
                    <strong>Owner's Justification:</strong> "{req.reasonNotes}"
                  </div>

                  {req.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRequestId(req.id);
                          setApprovedBusReg(`RB-01-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(1000 + Math.random() * 9000)}`);
                          setIsApproveModalOpen(true);
                        }}
                        style={{ padding: '9px 18px', background: '#00B87A', color: '#fff', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                      >
                        ✓ Approve & Assign Bus
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectBusRequest(req.id)}
                        style={{ padding: '9px 18px', background: 'rgba(225,29,72,0.15)', border: '1px solid #e11d48', color: '#fca5a5', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ 8. PROFILE TAB ══ */}
        {activeTab === 'PROFILE' && (
          <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                Super Admin Profile
              </h1>
              <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
                State Transit Authority Root Administrator
              </p>
            </div>

            <div style={{ background: 'rgba(10, 16, 26, 0.85)', borderRadius: 24, border: '1.5px solid rgba(168, 85, 247, 0.35)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#4c1d95', border: '1px solid #a855f7', color: '#c084fc', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                  SA
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff' }}>{user?.fullName || 'State Super Admin'}</div>
                  <div style={{ fontSize: 12, color: '#c084fc', fontWeight: 700, marginTop: 2 }}>PLATFORM_ADMIN · FULL SYSTEM ACCESS</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>CONTACT MOBILE</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{user?.phone || '9876500000'}</div>
                </div>
                <div style={{ padding: '12px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>OFFICIAL EMAIL</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>{user?.email || 'superadmin@ruralbus.gov.in'}</div>
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
                <span>Log Out of Super Admin</span>
              </button>
            </div>
          </div>
        )}

        {/* ══ NOTIFICATIONS / REAL-TIME OWNER AUDIT DRAWER ══ */}
        {isNotifsOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.82)',
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
                background: 'rgba(10, 16, 26, 0.98)',
                border: '1.5px solid #a855f7',
                borderRadius: 22,
                padding: 24,
                maxWidth: 580,
                width: '100%',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🔔</span>
                  <div>
                    <strong style={{ fontSize: 17, color: '#ffffff' }}>Operator Activity & Stoppage Audit Logs</strong>
                    <div style={{ fontSize: 12, color: '#c084fc' }}>Real-time updates from all fleet owners</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotifsOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Action: Mark All Read */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {notifications.length} Total audit events recorded
                </span>
                {unreadNotifsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                    }}
                    style={{ background: 'none', border: 'none', color: '#00D488', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                  >
                    ✓ Mark all as read
                  </button>
                )}
              </div>

              {/* Notifications List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: 13 }}>
                    No activity logs recorded yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        background: n.read ? 'rgba(15, 23, 42, 0.6)' : 'rgba(168, 85, 247, 0.12)',
                        border: `1px solid ${n.read ? 'rgba(255, 255, 255, 0.06)' : 'rgba(168, 85, 247, 0.35)'}`,
                        borderRadius: 12,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: n.type.includes('ADDED') ? 'rgba(0, 212, 136, 0.2)' : n.type.includes('DELETED') ? 'rgba(225, 29, 72, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                            color: n.type.includes('ADDED') ? '#00D488' : n.type.includes('DELETED') ? '#fca5a5' : '#38bdf8',
                          }}>
                            {n.type.replace('_', ' ')}
                          </span>
                          <strong style={{ fontSize: 13, color: '#ffffff' }}>{n.title}</strong>
                        </div>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{n.timestamp}</span>
                      </div>

                      <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                        {n.message}
                      </p>

                      <div style={{ fontSize: 11, color: '#c084fc', fontWeight: 700 }}>
                        Company: {n.tenantName}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsNotifsOpen(false)}
                style={{ padding: '12px', background: '#a855f7', color: '#fff', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
              >
                Close Audit Feed
              </button>
            </div>
          </div>
        )}
        </main>
      </div>

      {/* ══ GLOBAL REGISTER BUS MODAL (SUPER ADMIN ONLY) ══ */}
      {isAddBusOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 12000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => {
            if (!isSubmittingBus) {
              setIsAddBusOpen(false);
              setBusError(null);
            }
          }}
        >
          <div
            style={{
              background: isLight ? '#ffffff' : 'rgba(10, 18, 26, 0.98)',
              border: `1.5px solid ${isLight ? '#cbd5e1' : '#00D488'}`,
              borderRadius: 22,
              padding: 26,
              maxWidth: 540,
              width: '100%',
              boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
              color: isLight ? '#0f172a' : '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <strong style={{ fontSize: 18, color: isLight ? '#047857' : '#00D488' }}>
                  Register Bus & Assign to Operator
                </strong>
                <div style={{ fontSize: 12, color: isLight ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                  Persisted directly to the central PostgreSQL fleet registry
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmittingBus) {
                    setIsAddBusOpen(false);
                    setBusError(null);
                  }
                }}
                style={{ background: 'none', border: 'none', color: isLight ? '#64748b' : '#94a3b8', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {busError && (
              <div
                style={{
                  background: isLight ? '#fee2e2' : 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  borderRadius: 10,
                  padding: '12px 14px',
                  marginBottom: 16,
                  color: isLight ? '#b91c1c' : '#fca5a5',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>⚠️</span>
                <span>{busError}</span>
              </div>
            )}

            <form onSubmit={handleCreateBus} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 6 }}>
                  ASSIGN TO TRANSPORT OPERATOR
                </label>
                <select
                  value={busTargetTenantId || selectedTenant?.id || tenants[0]?.id || ''}
                  onChange={(e) => {
                    setBusTargetTenantId(e.target.value);
                    setBusError(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: isLight ? '#f8fafc' : '#050a0f',
                    border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 10,
                    color: isLight ? '#0f172a' : '#ffffff',
                    outline: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id} style={{ background: isLight ? '#ffffff' : '#050a0f', color: isLight ? '#0f172a' : '#ffffff' }}>
                      {t.companyName} ({t.ownerName})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 6 }}>
                    REGISTRATION NUMBER
                  </label>
                  <input
                    type="text"
                    value={newBusReg}
                    onChange={(e) => {
                      setNewBusReg(e.target.value.toUpperCase());
                      setBusError(null);
                    }}
                    placeholder="e.g. KA-01-EXP-01"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      background: isLight ? '#f8fafc' : 'rgba(5,10,15,0.8)',
                      border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: 10,
                      color: isLight ? '#0f172a' : '#ffffff',
                      outline: 'none',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 6 }}>
                    SEATING CAPACITY
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={newBusSeats}
                    onChange={(e) => setNewBusSeats(Number(e.target.value))}
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      background: isLight ? '#f8fafc' : 'rgba(5,10,15,0.8)',
                      border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: 10,
                      color: isLight ? '#0f172a' : '#ffffff',
                      outline: 'none',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: isLight ? '#1e293b' : '#cbd5e1', marginBottom: 6 }}>
                  BUS MODEL / VEHICLE NAME
                </label>
                <input
                  type="text"
                  value={newBusName}
                  onChange={(e) => {
                    setNewBusName(e.target.value);
                    setBusError(null);
                  }}
                  placeholder="e.g. Tata Starbus Ultra 40-Seater"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: isLight ? '#f8fafc' : 'rgba(5,10,15,0.8)',
                    border: `1.5px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: 10,
                    color: isLight ? '#0f172a' : '#ffffff',
                    outline: 'none',
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  disabled={isSubmittingBus}
                  onClick={() => {
                    setIsAddBusOpen(false);
                    setBusError(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '13px',
                    background: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255,255,255,0.15)'}`,
                    color: isLight ? '#475569' : '#cbd5e1',
                    fontWeight: 700,
                    borderRadius: 12,
                    cursor: isSubmittingBus ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBus}
                  style={{
                    flex: 2,
                    padding: '13px',
                    background: isSubmittingBus ? '#64748b' : '#00B87A',
                    color: '#fff',
                    fontWeight: 900,
                    borderRadius: 12,
                    border: 'none',
                    cursor: isSubmittingBus ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                  }}
                >
                  {isSubmittingBus ? 'Registering Bus…' : 'Save & Allocate Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onConfirm={logout}
        onCancel={() => setIsLogoutConfirmOpen(false)}
        isLight={isLight}
      />
    </div>
  );
}
