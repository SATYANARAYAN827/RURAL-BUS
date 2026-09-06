import { apiClient } from './api.client.js';

export interface TenantOwner {
  id: string;
  companyName: string;
  ownerName: string;
  phone: string;
  email: string;
  corridor: string;
  status: 'ACTIVE' | 'INACTIVE';
  busesCount: number;
  staffCount: number;
  createdAt: string;
}

export interface AdminNotification {
  id: string;
  tenantId: string;
  tenantName: string;
  type: 'STOPPAGE_ADDED' | 'STOPPAGE_UPDATED' | 'STOPPAGE_DELETED' | 'BUS_REQUEST';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface FleetBus {
  id: string;
  reg: string;
  name: string;
  route: string;
  tenantId: string;
  tenantName: string;
  driver: string;
  conductor: string;
  status: 'RUNNING' | 'STOPPED';
  speed: number;
  seats: number;
  stops?: string[];
}

export interface FleetStaff {
  id: string;
  name: string;
  role: 'Driver' | 'Conductor';
  status: string;
  bus: string;
  phone: string;
  tenantId: string;
  tenantName: string;
  licenseNo?: string;
}

export interface BusRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  ownerName: string;
  requestedModel: string;
  capacity: number;
  route: string;
  reasonNotes: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

const DEFAULT_TENANTS: TenantOwner[] = [
  {
    id: 'a54b0153-8246-4f88-bba9-7ef85b51a6ed',
    companyName: 'Kaveri Express Rural Transport',
    ownerName: 'Suresh Kumar',
    phone: '9876500002',
    email: 'suresh.admin@kaveribus.com',
    corridor: 'Bangalore ➔ Mysore',
    status: 'ACTIVE',
    busesCount: 0,
    staffCount: 4,
    createdAt: '12 Jan 2026',
  },
];

const DEFAULT_STAFF: FleetStaff[] = [
  { id: 'st-1', name: 'Ramesh Singh (Driver)', role: 'Driver', status: 'Available', bus: '', phone: '9876543210', tenantId: 'a54b0153-8246-4f88-bba9-7ef85b51a6ed', tenantName: 'Kaveri Express Rural Transport', licenseNo: 'DL-22-2018-004521' },
  { id: 'st-2', name: 'Ramesh Singh (Driver Backup)', role: 'Driver', status: 'Available', bus: '', phone: '9876500003', tenantId: 'a54b0153-8246-4f88-bba9-7ef85b51a6ed', tenantName: 'Kaveri Express Rural Transport', licenseNo: 'DL-22-2019-008910' },
  { id: 'st-3', name: 'Vijay Patel (Conductor)', role: 'Conductor', status: 'Available', bus: '', phone: '9876500004', tenantId: 'a54b0153-8246-4f88-bba9-7ef85b51a6ed', tenantName: 'Kaveri Express Rural Transport', licenseNo: 'CND-452109' },
];

const DEFAULT_REQUESTS: BusRequest[] = [];

class OperatorStoreService {
  private tenants: TenantOwner[] = [];
  private buses: FleetBus[] = [];
  private staff: FleetStaff[] = [];
  private requests: BusRequest[] = [];
  private notifications: AdminNotification[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Clear obsolete legacy keys
        try {
          localStorage.removeItem('gaonbus_tenants');
          localStorage.removeItem('gaonbus_fleet_buses');
          localStorage.removeItem('gaonbus_fleet_staff');
          localStorage.removeItem('gaonbus_bus_requests');
          localStorage.removeItem('gaonbus_admin_notifications');
        } catch {}

        const demoTenantIds = ['t-kaveri', 't-maatarini', 't-jagannath', 't-kalinga'];
        const demoTenantNames = ['Regional Rural Transport Lines', 'Express Transit Lines', 'Deluxe Rural Fleet', 'Maa Tarini', 'Jagannath'];

        const t = localStorage.getItem('ruralbus_tenants');
        if (t) {
          try {
            const parsed = JSON.parse(t);
            const filtered = Array.isArray(parsed)
              ? parsed.filter((item: any) =>
                  !demoTenantIds.includes(item.id) &&
                  !demoTenantNames.some((dn) => item.companyName?.includes(dn))
                )
              : [];
            this.tenants = filtered.length > 0 ? filtered : [...DEFAULT_TENANTS];
          } catch {
            this.tenants = [...DEFAULT_TENANTS];
          }
        } else {
          this.tenants = [...DEFAULT_TENANTS];
        }

        const demoRegs = [
          'OD-22-B-4521', 'OD-22-C-8910', 'OD-22-D-1122', 'RB-01-F-2040',
          'RB-22-B-4521', 'RB-22-C-8910', 'RB-22-D-7781', 'RB-22-E-3345',
          'RB-22-F-6612', 'RB-22-G-9090', 'RB-09-A-1020', 'RB-09-B-3340',
          'RB-01-C-8890', 'RB-01-D-5561', 'RB-05-E-7712'
        ];

        const b = localStorage.getItem('ruralbus_fleet_buses');
        if (b) {
          try {
            const parsed = JSON.parse(b);
            this.buses = Array.isArray(parsed)
              ? parsed.filter((item: any) =>
                  !demoRegs.includes(item.reg) &&
                  !demoTenantIds.includes(item.tenantId) &&
                  !item.reg?.startsWith('OD-22-')
                )
              : [];
          } catch {
            this.buses = [];
          }
        } else {
          this.buses = [];
        }

        const s = localStorage.getItem('ruralbus_fleet_staff');
        if (s) {
          try {
            const parsed = JSON.parse(s);
            const filtered = Array.isArray(parsed)
              ? parsed.filter((item: any) =>
                  !demoTenantIds.includes(item.tenantId) &&
                  !['Bipin Rout', 'Gopal Sahu', 'Pratap Nayak', 'Kishore Behera', 'Manoj Das', 'Bikram Jena'].includes(item.name)
                )
              : [];
            this.staff = filtered.length > 0 ? filtered : [...DEFAULT_STAFF];
          } catch {
            this.staff = [...DEFAULT_STAFF];
          }
        } else {
          this.staff = [...DEFAULT_STAFF];
        }

        const r = localStorage.getItem('ruralbus_bus_requests');
        if (r) {
          try {
            const parsed = JSON.parse(r);
            this.requests = Array.isArray(parsed)
              ? parsed.filter((item: any) => !demoTenantIds.includes(item.tenantId))
              : [];
          } catch {
            this.requests = [...DEFAULT_REQUESTS];
          }
        } else {
          this.requests = [...DEFAULT_REQUESTS];
        }

        this.saveTenants();
        this.saveBuses();
        this.saveStaff();
        this.saveRequests();
      } else {
        this.tenants = [...DEFAULT_TENANTS];
        this.buses = [];
        this.staff = [...DEFAULT_STAFF];
        this.requests = [...DEFAULT_REQUESTS];
      }
    } catch {
      this.tenants = [...DEFAULT_TENANTS];
      this.buses = [];
      this.staff = [...DEFAULT_STAFF];
      this.requests = [...DEFAULT_REQUESTS];
    }
  }

  private saveTenants() {
    try {
      localStorage.setItem('ruralbus_tenants', JSON.stringify(this.tenants));
    } catch {}
  }

  private saveBuses() {
    try {
      localStorage.setItem('ruralbus_fleet_buses', JSON.stringify(this.buses));
    } catch {}
  }

  private saveStaff() {
    try {
      localStorage.setItem('ruralbus_fleet_staff', JSON.stringify(this.staff));
    } catch {}
  }

  private saveRequests() {
    try {
      localStorage.setItem('ruralbus_bus_requests', JSON.stringify(this.requests));
    } catch {}
  }

  // ── TENANT MANAGEMENT (SUPER ADMIN) ──
  public getTenants(): TenantOwner[] {
    return this.tenants.map((t) => {
      const matchingBuses = this.buses.filter((b) => b.tenantId === t.id);
      return {
        ...t,
        busesCount: matchingBuses.length > 0 ? matchingBuses.length : (t.busesCount ?? 0),
        staffCount: t.staffCount ?? 1,
      };
    });
  }

  public getTenantById(id: string): TenantOwner | undefined {
    return this.getTenants().find((t) => t.id === id);
  }

  public async addTenant(data: {
    companyName: string;
    ownerName: string;
    phone: string;
    email: string;
    password: string;
    corridor?: string;
  }): Promise<{
    tenant: TenantOwner;
    sms: { sent: boolean; maskedPhone: string; message: string; error?: string };
  }> {
    const res = await apiClient.post('/api/v1/tenant/operators', {
      companyName: data.companyName.trim(),
      ownerName: data.ownerName.trim(),
      phone: data.phone.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password.trim(),
    });

    const op = res.data?.data?.operator;
    const owner = res.data?.data?.owner;
    const sms = res.data?.data?.sms || {
      sent: false,
      maskedPhone: `+91 ${data.phone.trim().slice(0, 2)}****${data.phone.trim().slice(-4)}`,
      message: 'SMS status unavailable',
    };

    const newTenant: TenantOwner = {
      id: op.id,
      companyName: op.companyName,
      ownerName: owner?.fullName || data.ownerName.trim(),
      phone: owner?.phone || op.contactPhone || data.phone.trim(),
      email: owner?.email || op.contactEmail || data.email.trim(),
      corridor: data.corridor?.trim() || 'Assigned Transit Corridor',
      status: op.status || 'ACTIVE',
      busesCount: 0,
      staffCount: 1,
      createdAt: op.createdAt
        ? new Date(op.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    };

    this.tenants = [newTenant, ...this.tenants.filter((t) => t.id !== newTenant.id)];
    this.saveTenants();
    return { tenant: newTenant, sms };
  }

  public updateTenant(id: string, updates: Partial<TenantOwner>): TenantOwner | undefined {
    this.tenants = this.tenants.map((t) => (t.id === id ? { ...t, ...updates } : t));
    this.saveTenants();
    return this.getTenantById(id);
  }

  // ── BUS MANAGEMENT ──
  public getBuses(tenantId?: string): FleetBus[] {
    if (!tenantId) return this.buses;
    return this.buses.filter((b) => b.tenantId === tenantId);
  }

  public async syncWithBackend(tenantId?: string): Promise<FleetBus[]> {
    // 1. Sync registered operators from PostgreSQL backend
    try {
      const opRes = await apiClient.get('/api/v1/tenant/operators');
      if (opRes.data?.success && Array.isArray(opRes.data.data?.operators) && opRes.data.data.operators.length > 0) {
        const demoTenantNames = ['Regional Rural Transport Lines', 'Express Transit Lines', 'Deluxe Rural Fleet', 'Maa Tarini', 'Jagannath'];
        const backendOperators: TenantOwner[] = opRes.data.data.operators
          .filter((op: any) => !demoTenantNames.some((dn) => op.companyName?.includes(dn)))
          .map((op: any) => {
            const existing = this.tenants.find((t) => t.id === op.id);
            return {
              id: op.id,
              companyName: op.companyName,
              ownerName: op.ownerName || existing?.ownerName || 'Operator Admin',
              phone: op.ownerPhone || op.contactPhone || existing?.phone || '',
              email: op.ownerEmail || op.contactEmail || existing?.email || '',
              corridor: existing?.corridor || (op.companyName?.includes('Kaveri') ? 'Bangalore ➔ Mysore' : 'Assigned Transit Corridor'),
              status: op.status || 'ACTIVE',
              busesCount: Number(op.busesCount ?? existing?.busesCount ?? 0),
              staffCount: Number(op.staffCount ?? existing?.staffCount ?? 1),
              createdAt: op.createdAt
                ? new Date(op.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : (existing?.createdAt || '12 Jan 2026'),
            };
          });
        if (backendOperators.length > 0) {
          this.tenants = backendOperators;
          this.saveTenants();
        }
      }
    } catch {}


    // 2. Sync registered buses from PostgreSQL backend
    try {
      const res = await apiClient.get('/api/v1/operator/buses', {
        params: tenantId ? { tenantId } : undefined,
      });
      if (res.data?.success && Array.isArray(res.data.data?.buses)) {
        const apiBuses: FleetBus[] = res.data.data.buses.map((b: any) => {
          const tenant = this.tenants.find((t) => t.id === b.tenantId);
          return {
            id: b.id,
            reg: b.registrationNumber,
            name: b.model,
            route: tenant?.corridor || 'Bangalore ➔ Mysore',
            tenantId: b.tenantId,
            tenantName: b.operatorName || tenant?.companyName || 'Kaveri Express Rural Transport',
            driver: 'Unassigned',
            conductor: 'Unassigned',
            status: b.status === 'ACTIVE' ? 'RUNNING' : b.status,
            speed: 0,
            seats: b.totalSeats,
          };
        });
        this.buses = apiBuses;
        this.saveBuses();
        return this.getBuses(tenantId);
      }
    } catch {}
    return this.getBuses(tenantId);
  }

  public async addBus(data: { reg: string; name: string; route?: string; tenantId: string; driver?: string; conductor?: string; seats?: number }): Promise<FleetBus> {
    const tenant = this.tenants.find((t) => t.id === data.tenantId);
    const regUpper = data.reg.trim().toUpperCase();

    // Call backend API (Super Admin authority only)
    let apiBus: any = null;
    try {
      const res = await apiClient.post('/api/v1/operator/buses', {
        tenantId: data.tenantId,
        registrationNumber: regUpper,
        model: data.name.trim(),
        totalSeats: data.seats || 40,
        status: 'ACTIVE',
      });
      apiBus = res.data?.data?.bus;
    } catch (err: any) {
      const errMsg = err?.response?.data?.error?.message || err?.message || 'Failed to register bus';
      throw new Error(errMsg);
    }

    const newBus: FleetBus = {
      id: apiBus?.id || `b-${Date.now()}`,
      reg: apiBus?.registrationNumber || regUpper,
      name: apiBus?.model || data.name.trim(),
      route: data.route?.trim() || tenant?.corridor || 'Assigned Transit Route',
      tenantId: data.tenantId,
      tenantName: apiBus?.operatorName || tenant?.companyName || 'Operator Fleet',
      driver: data.driver?.trim() || 'Unassigned',
      conductor: data.conductor?.trim() || 'Unassigned',
      status: 'RUNNING',
      speed: 0,
      seats: apiBus?.totalSeats || data.seats || 40,
    };

    this.buses = [newBus, ...this.buses.filter((b) => b.id !== newBus.id)];
    this.saveBuses();
    return newBus;
  }

  public updateBus(id: string, updates: Partial<FleetBus>): FleetBus | undefined {
    this.buses = this.buses.map((b) => (b.id === id ? { ...b, ...updates } : b));
    this.saveBuses();
    return this.buses.find((b) => b.id === id);
  }

  public async deleteBus(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.delete(`/api/v1/operator/buses/${id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message;
      if (msg) return { success: false, error: msg };
    }
    this.buses = this.buses.filter((b) => b.id !== id);
    this.saveBuses();
    return { success: true };
  }

  // ── STAFF MANAGEMENT ──
  public getStaff(tenantId?: string): FleetStaff[] {
    if (!tenantId) return this.staff;
    return this.staff.filter((s) => s.tenantId === tenantId);
  }

  public addStaff(data: { name: string; role: 'Driver' | 'Conductor'; phone: string; bus: string; tenantId: string; licenseNo?: string }): FleetStaff {
    const tenant = this.tenants.find((t) => t.id === data.tenantId);
    const newStaff: FleetStaff = {
      id: `st-${Date.now()}`,
      name: data.name.trim(),
      role: data.role,
      status: 'On Trip',
      bus: data.bus.trim() || 'Unassigned',
      phone: data.phone.trim(),
      tenantId: data.tenantId,
      tenantName: tenant?.companyName || 'Operator Fleet',
      licenseNo: data.licenseNo?.trim(),
    };

    this.staff = [newStaff, ...this.staff];
    this.saveStaff();

    apiClient.post('/api/v1/operator/staff', {
      fullName: newStaff.name,
      phone: newStaff.phone,
      role: newStaff.role === 'Driver' ? 'DRIVER' : 'CONDUCTOR',
    }).catch(() => {});

    return newStaff;
  }

  public updateStaff(id: string, updates: Partial<FleetStaff>): FleetStaff | undefined {
    this.staff = this.staff.map((s) => (s.id === id ? { ...s, ...updates } : s));
    this.saveStaff();
    return this.staff.find((s) => s.id === id);
  }

  public deleteStaff(id: string) {
    this.staff = this.staff.filter((s) => s.id !== id);
    this.saveStaff();
  }

  // ── BUS REQUESTS (OWNER ➔ SUPER ADMIN FLOW) ──
  public getRequests(tenantId?: string): BusRequest[] {
    if (!tenantId) return this.requests;
    return this.requests.filter((r) => r.tenantId === tenantId);
  }

  public requestNewBus(data: { tenantId: string; tenantName: string; ownerName: string; requestedModel: string; capacity: number; route: string; reasonNotes: string }): BusRequest {
    const newReq: BusRequest = {
      id: `req-${Date.now()}`,
      tenantId: data.tenantId,
      tenantName: data.tenantName,
      ownerName: data.ownerName,
      requestedModel: data.requestedModel.trim(),
      capacity: data.capacity || 40,
      route: data.route.trim(),
      reasonNotes: data.reasonNotes.trim(),
      status: 'PENDING',
      createdAt: 'Just now',
    };

    this.requests = [newReq, ...this.requests];
    this.saveRequests();
    return newReq;
  }

  public async approveBusRequest(requestId: string, regNumber: string): Promise<FleetBus | undefined> {
    const req = this.requests.find((r) => r.id === requestId);
    if (!req) return undefined;

    req.status = 'APPROVED';
    this.saveRequests();

    // Create the new bus for the owner
    const newBus = await this.addBus({
      reg: regNumber.trim().toUpperCase(),
      name: req.requestedModel,
      route: req.route,
      tenantId: req.tenantId,
      seats: req.capacity,
    });

    return newBus;
  }

  public rejectBusRequest(requestId: string) {
    this.requests = this.requests.map((r) => (r.id === requestId ? { ...r, status: 'REJECTED' as const } : r));
    this.saveRequests();
  }

  // ── SUPER ADMIN NOTIFICATIONS (OWNER ➔ SUPER ADMIN AUDIT TRAIL) ──
  public getNotifications(): AdminNotification[] {
    try {
      const stored = localStorage.getItem('ruralbus_admin_notifications') || localStorage.getItem('gaonbus_admin_notifications');
      if (stored) this.notifications = JSON.parse(stored);
    } catch {}
    return this.notifications;
  }

  public addNotification(data: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>): AdminNotification {
    const newNotif: AdminNotification = {
      ...data,
      id: `notif-${Date.now()}`,
      timestamp: 'Just now',
      read: false,
    };
    this.notifications = [newNotif, ...this.notifications];
    try {
      localStorage.setItem('ruralbus_admin_notifications', JSON.stringify(this.notifications));
    } catch {}
    window.dispatchEvent(new CustomEvent('ruralbus:notification-received', { detail: newNotif }));
    return newNotif;
  }

  public markNotificationsAsRead(): void {
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    try {
      localStorage.setItem('ruralbus_admin_notifications', JSON.stringify(this.notifications));
    } catch {}
    window.dispatchEvent(new CustomEvent('ruralbus:notification-received'));
  }
}

export const operatorStore = new OperatorStoreService();
