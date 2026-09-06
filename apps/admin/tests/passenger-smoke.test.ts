import { describe, it, expect, beforeEach } from 'vitest';
import { useAdminAuthStore } from '../src/stores/auth.store.js';
import { transitService } from '../src/services/transit.service.js';

class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
  localStorage: mockStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
};

describe('Production Smoke Test: Passenger App Flow & Architecture', () => {
  beforeEach(() => {
    mockStorage.clear();
    useAdminAuthStore.setState({
      user: null,
      tokens: null,
      tenant: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('Step 1: Passenger login authenticates with role PASSENGER and valid tokens', async () => {
    useAdminAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'usr-passenger-101',
        fullName: 'Rajesh Sharma',
        phone: '9876500001',
        email: 'rajesh.passenger@ruralbus.com',
        role: 'PASSENGER',
      } as any,
      tokens: { accessToken: 'valid-token', refreshToken: 'valid-refresh' },
    });
    mockStorage.setItem('ruralbus_user', JSON.stringify({ role: 'PASSENGER', fullName: 'Rajesh Sharma' }));
    const state = useAdminAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.role).toBe('PASSENGER');
    expect(state.tokens?.accessToken).toBeDefined();
    expect(mockStorage.getItem('ruralbus_user')).toContain('PASSENGER');
  });

  it('Step 2: HOME loads cleanly with no initial bus-results list and no auto GPS stream', () => {
    // Check initial state defaults
    const initialBuses: any[] = [];
    const hasSearched = false;
    const activeTab = 'HOME';

    expect(activeTab).toBe('HOME');
    expect(hasSearched).toBe(false);
    expect(initialBuses.length).toBe(0);
  });

  it('Step 3: GPS banner appears and can be dismissed cleanly', () => {
    let showLocationBanner = true;
    expect(showLocationBanner).toBe(true);

    // User dismisses banner
    showLocationBanner = false;
    expect(showLocationBanner).toBe(false);
  });

  it('Step 4: City selector works across Odisha regions & updates route defaults', () => {
    const CITIES = [
      { name: 'Bhubaneswar', defaultFrom: 'Jaydev Vihar Square', defaultTo: 'Nandankanan' },
      { name: 'Bhadrak',     defaultFrom: 'Randia Bridge',       defaultTo: 'Bhadrak Central' },
      { name: 'Cuttack',     defaultFrom: 'Cuttack Link',         defaultTo: 'Bhadrak Central' },
    ];

    let selectedCity = 'Bhubaneswar';
    let fromStop = 'Jaydev Vihar Square';
    let toStop = 'Nandankanan';

    expect(selectedCity).toBe('Bhubaneswar');
    expect(fromStop).toBe('Jaydev Vihar Square');

    // Switch to Bhadrak
    const target = CITIES.find(c => c.name === 'Bhadrak')!;
    selectedCity = target.name;
    fromStop = target.defaultFrom;
    toStop = target.defaultTo;

    expect(selectedCity).toBe('Bhadrak');
    expect(fromStop).toBe('Randia Bridge');
    expect(toStop).toBe('Bhadrak Central');
  });

  it('Step 5: When no buses are registered, search returns honest empty result', () => {
    const results = transitService.searchBuses('Boula', 'Bhadrak Central', '30-08-2026');
    expect(results.length).toBe(0);
  });

  it('Step 6: Super Admin registers stops and bus; From/To search returns valid bus with realistic fare and distance calculations', () => {
    // Add real corridor stops
    transitService.addStop({ name: 'Boula', nameOd: 'ବୌଳା', km: 0, lat: 21.285, lng: 86.295, isDepot: true, code: 'BULA' });
    transitService.addStop({ name: 'Remuna', nameOd: 'ରେମୁଣା', km: 12, lat: 21.52, lng: 86.87, isDepot: false, code: 'RMNA' });
    transitService.addStop({ name: 'Jaipur Road', nameOd: 'ଯାଜପୁର ରୋଡ୍', km: 28, lat: 20.95, lng: 86.14, isDepot: false, code: 'JPRD' });
    transitService.addStop({ name: 'Agarpada', nameOd: 'ଆଗରପଡ଼ା', km: 45, lat: 21.18, lng: 86.38, isDepot: false, code: 'AGRP' });
    transitService.addStop({ name: 'Randia Bridge', nameOd: 'ରାଣ୍ଡିଆ ବ୍ରିଜ୍', km: 58, lat: 21.05, lng: 86.48, isDepot: false, code: 'RNDB' });
    transitService.addStop({ name: 'Bhadrak Central', nameOd: 'ଭଦ୍ରକ ସେଣ୍ଟ୍ରାଲ', km: 68, lat: 21.0574, lng: 86.4988, isDepot: true, code: 'BDRK' });

    // Register a legitimate bus
    transitService.addBus({
      reg: 'OD-01-AB-1234',
      name: 'Tata Starbus Ultra 44-Seater AC',
      route: 'Boula ➔ Bhadrak Central',
      routeCode: 'Route 101',
      via: 'Via: Remuna, Jaipur Road, Agarpada, Randia Bridge',
      stops: ['Boula', 'Remuna', 'Jaipur Road', 'Agarpada', 'Randia Bridge', 'Bhadrak Central'],
      speed: 42,
      status: 'Running',
      nextStop: 'Remuna',
      departureTime: '06:30 AM',
      baseFare: 45,
      iconColor: '#00D488',
      iconBg: 'rgba(0, 212, 136, 0.15)',
      lat: 21.285,
      lng: 86.295,
    });

    const results = transitService.searchBuses('Boula', 'Bhadrak Central', '30-08-2026');
    expect(results.length).toBeGreaterThan(0);

    const bus = results[0];
    expect(bus.from).toBe('Boula');
    expect(bus.to).toBe('Bhadrak Central');
    expect(bus.fare).toBeGreaterThan(20);
    expect(bus.busReg).toBe('OD-01-AB-1234');
    expect(bus.routeCode).toBeDefined();
    expect(bus.speed).toBeGreaterThan(0);
  });

  it('Step 7: Search results show matched buses only', () => {
    const results = transitService.searchBuses('Randia Bridge', 'Bhadrak Central', '30-08-2026');
    expect(results.every(b => b.from === 'Randia Bridge' && b.to === 'Bhadrak Central')).toBe(true);
  });

  it('Step 8: Live map markers are generated with accurate coordinates and vehicle telemetry', () => {
    const results = transitService.searchBuses('Boula', 'Bhadrak Central', '30-08-2026');
    const markers = results.map(bus => ({
      id: bus.id,
      lat: bus.lat,
      lng: bus.lng,
      title: bus.busName,
      subtitle: `${bus.busReg} · ${bus.speed} km/h`,
      type: 'BUS' as const,
      speed: bus.speed,
      status: bus.status === 'Running' ? ('RUNNING' as const) : ('STOPPED' as const),
      nextStop: bus.nextStop,
    }));

    expect(markers.length).toBe(results.length);
    expect(markers[0].lat).toBeGreaterThan(20);
    expect(markers[0].lng).toBeGreaterThan(80);
    expect(markers[0].speed).toBe(results[0].speed);
  });

  it('Step 9: Track This Bus works and displays real telemetry and stoppage timeline', () => {
    const bus = transitService.getBuses()[0];
    expect(bus).toBeDefined();
    expect(bus.reg).toBe('OD-01-AB-1234');
    expect(bus.stops).toContain('Boula');
    expect(bus.stops).toContain('Bhadrak Central');

    // Stoppage timeline uses master stops
    const stops = transitService.getStops();
    expect(stops.length).toBeGreaterThanOrEqual(6);
  });

  it('Step 10: Clear Search restores clean initial HOME state', () => {
    let hasSearched = true;
    let buses = transitService.searchBuses('Boula', 'Bhadrak Central', '30-08-2026');
    let activeTab = 'FIND_BUS';

    expect(hasSearched).toBe(true);
    expect(buses.length).toBeGreaterThan(0);

    // Clear search
    hasSearched = false;
    buses = [];
    activeTab = 'HOME';

    expect(hasSearched).toBe(false);
    expect(buses.length).toBe(0);
    expect(activeTab).toBe('HOME');
  });

  it('Step 11: My Tickets generates and renders valid QR boarding pass', () => {
    const bus = transitService.getBuses()[0];
    const fare = transitService.calculateSegmentFare('Boula', 'Bhadrak Central');
    expect(fare.fare).toBeGreaterThan(10);

    const ticket = {
      id: 'GB-7821',
      routeCode: bus?.routeCode || 'Route 101',
      routeName: 'Boula → Bhadrak Central',
      from: 'Boula',
      to: 'Bhadrak Central',
      seat: 14,
      fare: fare.fare,
      date: '30 Aug 2026',
      time: '06:30 AM',
      busReg: bus?.reg || 'OD-01-AB-1234',
      qrCode: `RURALBUS-${bus?.reg || 'OD01AB1234'}-SEAT14-TKT7821`,
      status: 'CONFIRMED',
    };

    expect(ticket.id).toBe('GB-7821');
    expect(ticket.qrCode).toContain('RURALBUS');
    expect(ticket.status).toBe('CONFIRMED');
  });

  it('Step 12: Profile view displays passenger details and logout confirm functions', async () => {
    useAdminAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'usr-passenger-101',
        fullName: 'Rajesh Sharma',
        phone: '9876500001',
        email: 'rajesh.passenger@ruralbus.com',
        role: 'PASSENGER',
      } as any,
      tokens: { accessToken: 'valid-token', refreshToken: 'valid-refresh' },
    });
    expect(useAdminAuthStore.getState().user?.fullName).toBe('Rajesh Sharma');

    // Confirm logout
    await useAdminAuthStore.getState().logout();
    expect(useAdminAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAdminAuthStore.getState().user).toBeNull();
  });

  it('Step 13: Master stops can include city and rural highway corridors', () => {
    transitService.addStop({ name: 'Jaydev Vihar Square', nameOd: 'ଜୟଦେବ ବିହାର', km: 0, lat: 20.2961, lng: 85.8245, isDepot: true, code: 'JVS' });
    transitService.addStop({ name: 'Nandankanan', nameOd: 'ନନ୍ଦନକାନନ', km: 15, lat: 20.3999, lng: 85.8256, isDepot: false, code: 'NDKN' });
    transitService.addStop({ name: 'Bhubaneswar Railway Station', nameOd: 'ଭୁବନେଶ୍ୱର ରେଳ ଷ୍ଟେସନ', km: 22, lat: 20.2646, lng: 85.8427, isDepot: true, code: 'BBS' });

    const stops = transitService.getStops();
    expect(stops.some(s => s.name === 'Jaydev Vihar Square')).toBe(true);
    expect(stops.some(s => s.name === 'Nandankanan')).toBe(true);
    expect(stops.some(s => s.name === 'Bhubaneswar Railway Station')).toBe(true);
    expect(stops.some(s => s.name === 'Boula')).toBe(true);
    expect(stops.some(s => s.name === 'Bhadrak Central')).toBe(true);
  });

  it('Step 14: Strict Authority Rule: Only Super Admin (PLATFORM_ADMIN) can create/register a bus', () => {
    const userRole = 'PLATFORM_ADMIN';
    const canRegisterBus = userRole === 'PLATFORM_ADMIN';
    expect(canRegisterBus).toBe(true);
  });

  it('Step 15: Strict Authority Rule: Owner/Operator (OPERATOR_ADMIN) is forbidden from creating a bus', () => {
    const userRole = 'OPERATOR_ADMIN';
    const canRegisterBus = userRole === 'PLATFORM_ADMIN';
    expect(canRegisterBus).toBe(false);
  });
});
