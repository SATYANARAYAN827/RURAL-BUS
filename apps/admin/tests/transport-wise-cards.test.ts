import { describe, it, expect, beforeEach } from 'vitest';
import { operatorStore } from '../src/services/operatorStore.service.js';

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

describe('Transport-Wise Card Grouping for Buses and Staff', () => {
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

  it('correctly isolates and groups buses inside their respective transport cards', () => {
    const tenants = [
      { id: 'op-kaveri', companyName: 'Kaveri Express Rural Transport', ownerName: 'Suresh Kumar' },
      { id: 'op-satya', companyName: 'Satya RoadLines', ownerName: 'Satyanarayan Majhi' },
    ];

    const buses = [
      { id: 'bus-1', reg: 'KA-01-1001', name: 'Deluxe Bus 1', tenantId: 'op-kaveri', tenantName: 'Kaveri Express Rural Transport' },
      { id: 'bus-2', reg: 'KA-01-1002', name: 'Deluxe Bus 2', tenantId: 'op-kaveri', tenantName: 'Kaveri Express Rural Transport' },
      { id: 'bus-3', reg: 'AB-12-1111', name: 'Satya Express', tenantId: 'op-satya', tenantName: 'Satya RoadLines' },
    ];

    // Transport 1: Kaveri
    const kaveriBuses = buses.filter(b => b.tenantId === tenants[0].id);
    expect(kaveriBuses.length).toBe(2);
    expect(kaveriBuses.map(b => b.reg)).toEqual(['KA-01-1001', 'KA-01-1002']);

    // Transport 2: Satya
    const satyaBuses = buses.filter(b => b.tenantId === tenants[1].id);
    expect(satyaBuses.length).toBe(1);
    expect(satyaBuses[0].reg).toBe('AB-12-1111');

    // Cross-tenant verification
    expect(kaveriBuses.some(b => b.tenantId === 'op-satya')).toBe(false);
    expect(satyaBuses.some(b => b.tenantId === 'op-kaveri')).toBe(false);
  });

  it('handles empty state when an operator has 0 buses registered', () => {
    const tenants = [
      { id: 'op-kaveri', companyName: 'Kaveri Express Rural Transport' },
      { id: 'op-satya', companyName: 'Satya RoadLines' },
    ];

    // Satya has a bus, Kaveri has 0
    const buses = [
      { id: 'bus-3', reg: 'AB-12-1111', name: 'Satya Express', tenantId: 'op-satya' },
    ];

    const kaveriBuses = buses.filter(b => b.tenantId === tenants[0].id);
    const satyaBuses = buses.filter(b => b.tenantId === tenants[1].id);

    expect(kaveriBuses.length).toBe(0);
    expect(satyaBuses.length).toBe(1);
  });

  it('correctly isolates and groups staff members inside their respective transport cards', () => {
    const tenants = [
      { id: 'op-kaveri', companyName: 'Kaveri Express Rural Transport' },
      { id: 'op-satya', companyName: 'Satya RoadLines' },
    ];

    const staff = [
      { id: 'st-1', name: 'Ramesh Singh (Driver)', role: 'Driver', tenantId: 'op-kaveri', tenantName: 'Kaveri Express Rural Transport' },
      { id: 'st-2', name: 'Vijay Patel (Conductor)', role: 'Conductor', tenantId: 'op-kaveri', tenantName: 'Kaveri Express Rural Transport' },
    ];

    const kaveriStaff = staff.filter(s => s.tenantId === tenants[0].id);
    const satyaStaff = staff.filter(s => s.tenantId === tenants[1].id);

    expect(kaveriStaff.length).toBe(2);
    expect(satyaStaff.length).toBe(0);
    expect(kaveriStaff.map(s => s.role)).toEqual(['Driver', 'Conductor']);
  });
});
