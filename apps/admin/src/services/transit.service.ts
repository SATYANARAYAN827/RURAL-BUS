import { apiClient } from './api.client.js';

export interface MasterStop {
  id: string;
  name: string;
  nameOd: string;
  lat: number;
  lng: number;
  km: number;
  code: string;
}

export interface MasterBus {
  id: string;
  tripId: string;
  name: string;
  reg: string;
  type: string;
  routeCode: string;
  via: string;
  stops: string[]; // List of stop names in sequence
  speed: number;
  status: 'Running' | 'Slowed' | 'Stopped' | 'Offline';
  nextStop: string;
  departureTime: string;
  baseFare: number;
  iconColor: string;
  iconBg: string;
  lat: number;
  lng: number;
}

export interface SearchBusResult {
  id: string;
  tripId: string;
  busName: string;
  busReg: string;
  type: string;
  routeCode: string;
  via: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  arrivingIn: string;
  arrivingAt: string;
  duration: string;
  fare: number;
  status: 'Running' | 'Slowed' | 'Stopped' | 'Offline';
  speed: number;
  currentLocation: string;
  nextStop: string;
  etaMinutes: number;
  iconColor: string;
  iconBg: string;
  lat: number;
  lng: number;
}

const DEMO_STOP_NAMES = [
  'Sitapura', 'India Gate', 'Kumbha Marg', 'Haldi Ghati',
  'Boula', 'Ramana', 'Jajpur Road', 'Dhamara', 'Agarpada', 'Bhadrak Central',
  'Pinjrapol', 'Sanganer', 'Jaipur', 'Tonk', 'Gopalpura', 'Durgapura', 'Gandhinagar',
  'Rambagh', 'Ajmeri', 'B2 Bypass', 'Soro', 'Balikuda', 'Bant', 'Dhusuri',
  'Randia', 'Kendrapara', 'Cuttack', 'Keonjhar', 'Jaydev', 'Baramunda',
  'Bhubaneswar', 'Biju Patnaik', 'Nandankanan'
];
class TransitStore {
  private stops: MasterStop[] = [];
  private buses: MasterBus[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.removeItem('gaonbus_master_stops');
          localStorage.removeItem('gaonbus_master_buses');
          localStorage.removeItem('ruralbus_master_stops');
          localStorage.removeItem('ruralbus_master_buses');
        } catch {}

        this.stops = [];
        this.buses = [];
      } else {
        this.stops = [];
        this.buses = [];
      }
    } catch {
      this.stops = [];
      this.buses = [];
    }
  }

  public async syncWithBackend() {
    try {
      const res = await apiClient.get<{ success: boolean; data: { stops: Array<any> } }>('/api/v1/discovery/stops');
      if (res.data?.success && Array.isArray(res.data.data?.stops)) {
        const nonDemoStops = res.data.data.stops.filter(
          (s: any) => !DEMO_STOP_NAMES.some((dn) => s.name?.toLowerCase().includes(dn.toLowerCase()))
        );
        this.stops = nonDemoStops.map((s: any, idx: number) => ({
          id: s.id,
          name: s.name,
          nameOd: s.name,
          lat: s.location?.latitude ?? s.latitude ?? 0,
          lng: s.location?.longitude ?? s.longitude ?? 0,
          km: idx === 0 ? 0 : idx === 1 ? 95 : 145.5,
          code: s.code || `STP-${idx + 1}`,
        }));
        this.saveStops();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ruralbus:stops-updated', { detail: { stops: this.stops } }));
        }
      }
    } catch {}
  }

  private saveStops() {
    try {
      localStorage.setItem('ruralbus_master_stops', JSON.stringify(this.stops));
    } catch {}
  }

  private saveBuses() {
    try {
      localStorage.setItem('ruralbus_master_buses', JSON.stringify(this.buses));
    } catch {}
  }

  public getStops(query = ''): MasterStop[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.stops;
    return this.stops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nameOd.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    );
  }

  public addStop(stop: Omit<MasterStop, 'id'>, actor?: { tenantName?: string; actor?: string }): MasterStop {
    const newStop: MasterStop = {
      ...stop,
      id: `s-${Date.now()}`,
    };
    this.stops = [...this.stops, newStop].sort((a, b) => a.km - b.km);
    this.saveStops();

    // Push to backend if authenticated
    apiClient.post('/api/v1/operator/stops', {
      name: stop.name,
      code: stop.code,
      latitude: stop.lat,
      longitude: stop.lng,
      geofenceRadiusMeters: 100,
    }).catch(() => {});

    // Notify Super Admin
    if (typeof window !== 'undefined') {
      try {
        const storedNotifs = localStorage.getItem('ruralbus_admin_notifications') || localStorage.getItem('gaonbus_admin_notifications') || '[]';
        const notifs = JSON.parse(storedNotifs);
        const newNotif = {
          id: `notif-${Date.now()}`,
          tenantId: 't-operator',
          tenantName: actor?.tenantName || 'Fleet Operator',
          type: 'STOPPAGE_ADDED',
          title: 'New Stoppage Added',
          message: `${actor?.tenantName || 'Owner'} added new stoppage '${newStop.name}' (${newStop.km} km) to highway corridor.`,
          timestamp: 'Just now',
          read: false,
        };
        localStorage.setItem('ruralbus_admin_notifications', JSON.stringify([newNotif, ...notifs]));
        window.dispatchEvent(new CustomEvent('ruralbus:notification-received', { detail: newNotif }));
        window.dispatchEvent(new CustomEvent('ruralbus:stops-updated', { detail: { stops: this.stops } }));
      } catch {}
    }

    return newStop;
  }

  public updateStop(id: string, updates: Partial<MasterStop>, actor?: { tenantName?: string; actor?: string }): MasterStop | undefined {
    const oldStop = this.stops.find((s) => s.id === id);
    if (!oldStop) return undefined;

    const updated = { ...oldStop, ...updates };
    this.stops = this.stops.map((s) => (s.id === id ? updated : s)).sort((a, b) => a.km - b.km);
    this.saveStops();

    // Safely update all active bus routes referencing the renamed stop
    if (updates.name && oldStop.name !== updates.name) {
      this.buses = this.buses.map((b) => ({
        ...b,
        stops: b.stops.map((s) => (s.toLowerCase() === oldStop.name.toLowerCase() ? updates.name! : s)),
        nextStop: b.nextStop.toLowerCase() === oldStop.name.toLowerCase() ? updates.name! : b.nextStop,
      }));
      this.saveBuses();
    }

    // Notify Super Admin
    if (typeof window !== 'undefined') {
      try {
        const storedNotifs = localStorage.getItem('ruralbus_admin_notifications') || localStorage.getItem('gaonbus_admin_notifications') || '[]';
        const notifs = JSON.parse(storedNotifs);
        const newNotif = {
          id: `notif-${Date.now()}`,
          tenantId: 't-operator',
          tenantName: actor?.tenantName || 'Fleet Operator',
          type: 'STOPPAGE_UPDATED',
          title: 'Stoppage Updated',
          message: `${actor?.tenantName || 'Owner'} modified stoppage '${oldStop.name}' ➔ '${updated.name}' (${updated.km} km).`,
          timestamp: 'Just now',
          read: false,
        };
        localStorage.setItem('ruralbus_admin_notifications', JSON.stringify([newNotif, ...notifs]));
        window.dispatchEvent(new CustomEvent('ruralbus:notification-received', { detail: newNotif }));
        window.dispatchEvent(new CustomEvent('ruralbus:stops-updated', { detail: { stops: this.stops } }));
      } catch {}
    }

    return updated;
  }

  public deleteStop(id: string, actor?: { tenantName?: string; actor?: string }) {
    const deletedStop = this.stops.find((s) => s.id === id);
    this.stops = this.stops.filter((s) => s.id !== id);
    this.saveStops();

    // Safely adjust active bus routes without breaking in-transit trips
    if (deletedStop) {
      this.buses = this.buses.map((b) => {
        const remaining = b.stops.filter((s) => s.toLowerCase() !== deletedStop.name.toLowerCase());
        return {
          ...b,
          stops: remaining.length >= 2 ? remaining : b.stops,
          nextStop: b.nextStop.toLowerCase() === deletedStop.name.toLowerCase() ? (remaining[0] || '') : b.nextStop,
        };
      });
      this.saveBuses();
    }

    // Notify Super Admin
    if (typeof window !== 'undefined') {
      try {
        const storedNotifs = localStorage.getItem('ruralbus_admin_notifications') || localStorage.getItem('gaonbus_admin_notifications') || '[]';
        const notifs = JSON.parse(storedNotifs);
        const newNotif = {
          id: `notif-${Date.now()}`,
          tenantId: 't-operator',
          tenantName: actor?.tenantName || 'Fleet Operator',
          type: 'STOPPAGE_DELETED',
          title: 'Stoppage Removed',
          message: `${actor?.tenantName || 'Owner'} deleted stoppage '${deletedStop?.name || id}' from highway corridor.`,
          timestamp: 'Just now',
          read: false,
        };
        localStorage.setItem('ruralbus_admin_notifications', JSON.stringify([newNotif, ...notifs]));
        window.dispatchEvent(new CustomEvent('ruralbus:notification-received', { detail: newNotif }));
        window.dispatchEvent(new CustomEvent('ruralbus:stops-updated', { detail: { stops: this.stops } }));
      } catch {}
    }
  }

  public updateBusStops(busId: string, stops: string[], actor?: { tenantName?: string; actor?: string }) {
    this.buses = this.buses.map((b) => (b.id === busId ? { ...b, stops, via: `Via: ${stops.slice(1, -1).join(', ') || 'Direct'}` } : b));
    this.saveBuses();

    if (typeof window !== 'undefined') {
      try {
        const storedNotifs = localStorage.getItem('ruralbus_admin_notifications') || localStorage.getItem('gaonbus_admin_notifications') || '[]';
        const notifs = JSON.parse(storedNotifs);
        const bus = this.buses.find(b => b.id === busId);
        const newNotif = {
          id: `notif-${Date.now()}`,
          tenantId: 't-operator',
          tenantName: actor?.tenantName || 'Fleet Operator',
          type: 'STOPPAGE_UPDATED',
          title: 'Bus Route Stops Updated',
          message: `${actor?.tenantName || 'Owner'} updated stoppage sequence on vehicle ${bus?.reg || busId} (${stops.join(' ➔ ')}).`,
          timestamp: 'Just now',
          read: false,
        };
        localStorage.setItem('ruralbus_admin_notifications', JSON.stringify([newNotif, ...notifs]));
        window.dispatchEvent(new CustomEvent('ruralbus:notification-received', { detail: newNotif }));
        window.dispatchEvent(new CustomEvent('ruralbus:stops-updated', { detail: { stops: this.stops, buses: this.buses } }));
      } catch {}
    }
  }

  public getBuses(): MasterBus[] {
    return this.buses;
  }

  public addBus(bus: Omit<MasterBus, 'id'>): MasterBus {
    const newBus: MasterBus = {
      ...bus,
      id: `b-${Date.now()}`,
    };
    this.buses = [...this.buses, newBus];
    this.saveBuses();

    // Push to backend if authenticated
    apiClient.post('/api/v1/operator/buses', {
      registrationNumber: bus.reg,
      model: bus.name,
      totalSeats: 40,
    }).catch(() => {});

    return newBus;
  }

  public deleteBus(id: string) {
    this.buses = this.buses.filter((b) => b.id !== id);
    this.saveBuses();
  }

  public searchBuses(from: string, to: string, _date: string): SearchBusResult[] {
    const fromClean = from.trim().toLowerCase();
    const toClean = to.trim().toLowerCase();

    // Find stop coordinates to compute realistic distance & fare
    const fromStopObj = this.stops.find((s) => s.name.toLowerCase().includes(fromClean) || fromClean.includes(s.name.toLowerCase()));
    const toStopObj = this.stops.find((s) => s.name.toLowerCase().includes(toClean) || toClean.includes(s.name.toLowerCase()));

    const distKm = fromStopObj && toStopObj ? Math.abs(toStopObj.km - fromStopObj.km) : 80;

    return this.buses.map((b, idx) => {
      // Calculate dynamic fare based on segment distance
      const segmentFare = Math.max(30, Math.round(20 + distKm * 1.15 + (idx * 5)));
      const baseEtaMins = 18 + idx * 9;
      const durationHours = Math.floor(distKm / 35);
      const durationMins = Math.round((distKm % 35) * 1.7);
      const durationStr = durationHours > 0 ? `${durationHours}h ${durationMins}m` : `${durationMins}m`;

      return {
        id: b.id,
        tripId: b.tripId || `trip-${b.id}`,
        busName: b.name,
        busReg: b.reg,
        type: b.type,
        routeCode: b.routeCode,
        via: b.via,
        from: from || '',
        to: to || '',
        departure: b.departureTime,
        arrival: '09:30 AM',
        arrivingIn: b.status === 'Running' ? `${baseEtaMins} min` : 'Scheduled',
        arrivingAt: toStopObj?.name ? `(At ${toStopObj.name})` : '',
        duration: durationStr,
        fare: segmentFare,
        status: b.status,
        speed: b.speed,
        currentLocation: b.status === 'Running' ? `Near ${b.nextStop}` : 'Scheduled Departure',
        nextStop: b.nextStop || 'Scheduled Stop',
        etaMinutes: baseEtaMins,
        iconColor: b.iconColor,
        iconBg: b.iconBg,
        lat: b.lat,
        lng: b.lng,
      };
    });
  }

  public calculateSegmentFare(fromName: string, toName: string): { fare: number; distanceKm: number } {
    const fromClean = fromName.trim().toLowerCase();
    const toClean = toName.trim().toLowerCase();
    const s1 = this.stops.find((s) => s.name.toLowerCase() === fromClean || fromClean.includes(s.name.toLowerCase()));
    const s2 = this.stops.find((s) => s.name.toLowerCase() === toClean || toClean.includes(s.name.toLowerCase()));
    const distanceKm = s1 && s2 ? Math.abs(s2.km - s1.km) : 25;
    const fare = Math.max(15, Math.round(15 + distanceKm * 1.15));
    return { fare, distanceKm };
  }
}

export const transitService = new TransitStore();
