import { describe, it, expect, beforeEach } from 'vitest';
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

describe('Routes Purge and Bus-Location-Wise Cards Verification', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).window = {
      localStorage: mockStorage,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    };
  });

  it('1. Purges all 24 cached demo stop names on initialization', () => {
    // Simulate legacy demo stops in localStorage
    const demoStops = [
      { id: '1', name: 'Pinjrapol Gaushala', km: 5.5, code: 'PNJR' },
      { id: '2', name: 'Sanganer Flyover', km: 6.8, code: 'SNGN' },
      { id: '3', name: 'Jaipur Airport Circle', km: 8.2, code: 'JPR' },
      { id: '4', name: 'Tonk Phatak Circle', km: 14.3, code: 'TNK' },
      { id: '5', name: 'Nandankanan', km: 178, code: 'NDKN' },
      { id: '6', name: 'Balikuda', km: 76, code: 'BLKD' },
      { id: '7', name: 'Bant Junction', km: 76, code: 'BNTJ' },
      { id: '8', name: 'Randia Bridge', km: 92, code: 'RNDB' },
      { id: '9', name: 'Kendrapara', km: 120, code: 'KNDR' },
    ];
    mockStorage.setItem('ruralbus_master_stops', JSON.stringify(demoStops));

    // Re-initialize store
    const store = new (transitService.constructor as any)();
    const stops = store.getStops();

    // Verify none of the demo stops exist and defaults are not hardcoded
    expect(stops.some((s: any) => s.name === 'Pinjrapol Gaushala')).toBe(false);
    expect(stops.some((s: any) => s.name === 'Sanganer Flyover')).toBe(false);
    expect(stops.some((s: any) => s.name === 'Jaipur Airport Circle')).toBe(false);
    expect(stops.some((s: any) => s.name === 'Tonk Phatak Circle')).toBe(false);
    expect(stops.some((s: any) => s.name === 'Nandankanan')).toBe(false);
    expect(stops.some((s: any) => s.name === 'Balikuda')).toBe(false);

    // Verify stops start empty until published from real backend
    expect(stops.length).toBe(0);
  });

  it('2. Fare calculation operates on real corridor stops', () => {
    const store = new (transitService.constructor as any)();
    store.addStop({ name: 'Bangalore Majestic Central', km: 0, lat: 12.9774, lng: 77.5729, code: 'SBC-MAJ', nameOd: 'Bangalore Majestic Central' });
    store.addStop({ name: 'Mandya Highway Junction', km: 95, lat: 12.5224, lng: 76.8974, code: 'MDY-HWY', nameOd: 'Mandya Highway Junction' });
    store.addStop({ name: 'Mysore Suburban Bus Terminal', km: 145.5, lat: 12.3082, lng: 76.6534, code: 'MYS-SUB', nameOd: 'Mysore Suburban Bus Terminal' });

    const calc = store.calculateSegmentFare(
      'Bangalore Majestic Central',
      'Mysore Suburban Bus Terminal'
    );
    expect(calc.distanceKm).toBeGreaterThanOrEqual(140);
    expect(calc.fare).toBeGreaterThan(150);
  });
});
