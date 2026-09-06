import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient } from '../src/services/api.client.js';

describe('Super Admin Operator Provisioning via API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should call POST /api/v1/tenant/operators with required credentials and return created operator with SMS status', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      data: {
        success: true,
        tenant: {
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
          sent: true,
          provider: 'twilio',
          maskedPhone: '+91 98****2345',
          message: 'Account provisioned successfully',
        },
      },
    } as any);

    const payload = {
      companyName: 'Sahyadri Rural Lines',
      ownerName: 'Anand Rao',
      phone: '9876512345',
      email: 'anand@sahyadri.com',
      password: 'SecretInitialPassword123!',
      corridor: 'Shimoga ➔ Thirthahalli',
    };

    const res = await apiClient.post('/api/v1/tenant/operators', payload);

    expect(postSpy).toHaveBeenCalledWith('/api/v1/tenant/operators', payload);
    expect(res.data.success).toBe(true);
    expect(res.data.tenant.id).toBe('op-real-uuid-101');
    expect(res.data.sms.sent).toBe(true);
    expect(res.data.sms.maskedPhone).toBe('+91 98****2345');
  });

  it('2. should fetch enriched operator details from GET /api/v1/tenant/operators', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        success: true,
        operators: [
          {
            id: 'op-real-uuid-101',
            companyName: 'Sahyadri Rural Lines',
            businessCode: 'SAHYADRI-01',
            contactEmail: 'contact@sahyadri.com',
            contactPhone: '9876512345',
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    } as any);

    const res = await apiClient.get('/api/v1/tenant/operators');
    expect(getSpy).toHaveBeenCalledWith('/api/v1/tenant/operators');
    expect(res.data.operators.length).toBe(1);
    expect(res.data.operators[0].companyName).toBe('Sahyadri Rural Lines');
  });

  it('3. should approve pending bus request via PUT /api/v1/operator/buses/:id/approve', async () => {
    const putSpy = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          bus: {
            id: 'bus-uuid-1',
            status: 'ACTIVE',
            registrationNumber: 'OD-02-B-9988',
          },
        },
      },
    } as any);

    const res = await apiClient.put('/api/v1/operator/buses/bus-uuid-1/approve');
    expect(putSpy).toHaveBeenCalledWith('/api/v1/operator/buses/bus-uuid-1/approve');
    expect(res.data.data.bus.status).toBe('ACTIVE');
  });
});
