import { describe, it, expect, beforeEach, vi } from 'vitest';
import { operatorStore } from '../src/services/operatorStore.service.js';
import { apiClient } from '../src/services/api.client.js';

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

describe('Super Admin Operator Store & Owner Provisioning', () => {
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
    vi.restoreAllMocks();
  });

  it('1. should call POST /api/v1/tenant/operators with required fields and not persist password in store', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          operator: {
            id: 'op-real-uuid-101',
            companyName: 'Sahyadri Rural Lines',
            businessCode: 'SAHYADRI-01',
            contactEmail: 'contact@sahyadri.com',
            contactPhone: '9876512345',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
          owner: {
            id: 'usr-real-uuid-202',
            fullName: 'Anand Rao',
            email: 'anand@sahyadri.com',
            phone: '9876512345',
            role: 'OPERATOR_ADMIN',
          },
          sms: {
            sent: false,
            provider: 'none',
            maskedPhone: '+91 98****2345',
            message: 'No live SMS gateway configured in environment',
          },
        },
      },
    } as any);

    const result = await operatorStore.addTenant({
      companyName: 'Sahyadri Rural Lines',
      ownerName: 'Anand Rao',
      phone: '9876512345',
      email: 'anand@sahyadri.com',
      password: 'SecretInitialPassword123!',
      corridor: 'Shimoga ➔ Thirthahalli',
    });

    expect(postSpy).toHaveBeenCalledWith('/api/v1/tenant/operators', {
      companyName: 'Sahyadri Rural Lines',
      ownerName: 'Anand Rao',
      phone: '9876512345',
      email: 'anand@sahyadri.com',
      password: 'SecretInitialPassword123!',
    });

    // 2. Real database ID returned
    expect(result.tenant.id).toBe('op-real-uuid-101');
    expect(result.tenant.busesCount).toBe(0);
    expect(result.tenant.staffCount).toBe(1);

    // 3. ZERO PLAINTEXT PASSWORD in store or localStorage
    expect((result.tenant as any).password).toBeUndefined();
    expect((result.tenant as any).initialPassword).toBeUndefined();

    const storedTenantsRaw = mockStorage.getItem('ruralbus_tenants');
    expect(storedTenantsRaw).not.toBeNull();
    expect(storedTenantsRaw).not.toContain('SecretInitialPassword123!');

    // 4. Honest SMS reporting
    expect(result.sms.sent).toBe(false);
    expect(result.sms.maskedPhone).toBe('+91 98****2345');
    expect(result.sms.message).toContain('No live SMS gateway configured');
  });

  it('2. should ingest enriched operator details from GET /api/v1/tenant/operators during syncWithBackend', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/v1/tenant/operators') {
        return {
          data: {
            success: true,
            data: {
              operators: [
                {
                  id: 'a54b0153-8246-4f88-bba9-7ef85b51a6ed',
                  companyName: 'Kaveri Express Rural Transport',
                  ownerName: 'Suresh Kumar',
                  ownerPhone: '9876500002',
                  ownerEmail: 'suresh.admin@kaveribus.com',
                  status: 'ACTIVE',
                  busesCount: 0,
                  staffCount: 4,
                  createdAt: '2026-01-12T00:00:00.000Z',
                },
                {
                  id: 'op-real-uuid-101',
                  companyName: 'Sahyadri Rural Lines',
                  ownerName: 'Anand Rao',
                  ownerPhone: '9876512345',
                  ownerEmail: 'anand@sahyadri.com',
                  status: 'ACTIVE',
                  busesCount: 0,
                  staffCount: 1,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
          },
        } as any;
      }
      if (url === '/api/v1/operator/buses') {
        return { data: { success: true, data: { buses: [] } } } as any;
      }
      return { data: { success: true, data: {} } } as any;
    });

    await operatorStore.syncWithBackend();

    const tenants = operatorStore.getTenants();
    expect(tenants.length).toBe(2);

    const sahyadri = tenants.find((t) => t.id === 'op-real-uuid-101');
    expect(sahyadri).toBeDefined();
    expect(sahyadri?.ownerName).toBe('Anand Rao');
    expect(sahyadri?.busesCount).toBe(0);
    expect(sahyadri?.staffCount).toBe(1);

    const kaveri = tenants.find((t) => t.id === 'a54b0153-8246-4f88-bba9-7ef85b51a6ed');
    expect(kaveri).toBeDefined();
    expect(kaveri?.ownerName).toBe('Suresh Kumar');
    expect(kaveri?.staffCount).toBe(4);
  });
});
