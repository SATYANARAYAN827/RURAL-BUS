import { describe, it, expect } from 'vitest';
import { resolveAdminAccessStatus } from '../src/components/guards/RoleGuard.js';
import type { AuthUser } from '@ruralbus/shared-types';

describe('Admin Web RoleGuard Access Evaluation', () => {
  const baseUser: AuthUser = {
    id: 'user-1',
    fullName: 'Test User',
    phone: '9876543210',
    email: 'user@test.com',
    role: 'OPERATOR_ADMIN',
    tenantId: 'tenant-1',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should return LOADING when auth initialization is in progress', () => {
    const status = resolveAdminAccessStatus({
      isAuthenticated: false,
      user: null,
      isLoading: true,
    });
    expect(status).toBe('LOADING');
  });

  it('should return UNAUTHENTICATED when user is not logged in', () => {
    const status = resolveAdminAccessStatus({
      isAuthenticated: false,
      user: null,
      isLoading: false,
    });
    expect(status).toBe('UNAUTHENTICATED');
  });

  it('should return AUTHORIZED when user has role OPERATOR_ADMIN', () => {
    const status = resolveAdminAccessStatus({
      isAuthenticated: true,
      user: { ...baseUser, role: 'OPERATOR_ADMIN' },
      isLoading: false,
    });
    expect(status).toBe('AUTHORIZED');
  });

  it('should return AUTHORIZED when user has role PASSENGER', () => {
    const status = resolveAdminAccessStatus({
      isAuthenticated: true,
      user: { ...baseUser, role: 'PASSENGER', tenantId: null },
      isLoading: false,
    });
    expect(status).toBe('AUTHORIZED');
  });

  it('should return AUTHORIZED when user has role DRIVER', () => {
    const status = resolveAdminAccessStatus({
      isAuthenticated: true,
      user: { ...baseUser, role: 'DRIVER' },
      isLoading: false,
    });
    expect(status).toBe('AUTHORIZED');
  });

  it('should return AUTHORIZED when user has role CONDUCTOR', () => {
    const status = resolveAdminAccessStatus({
      isAuthenticated: true,
      user: { ...baseUser, role: 'CONDUCTOR' },
      isLoading: false,
    });
    expect(status).toBe('AUTHORIZED');
  });
});
