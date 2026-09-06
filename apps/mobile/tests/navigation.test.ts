import { describe, it, expect } from 'vitest';
import { resolveNavigatorType } from '../src/navigation/RootNavigator.js';
import type { AuthUser } from '@ruralbus/shared-types';

describe('Dynamic Role-Based Navigation Resolution', () => {
  const baseUser: AuthUser = {
    id: 'test-user-id',
    fullName: 'Dynamic User',
    phone: '9999999999',
    email: 'user@test.com',
    role: 'PASSENGER',
    tenantId: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should return LOADING when session initialization is in progress', () => {
    const navType = resolveNavigatorType({
      isAuthenticated: false,
      user: null,
      isLoading: true,
    });
    expect(navType).toBe('LOADING');
  });

  it('should return AUTH when user is unauthenticated', () => {
    const navType = resolveNavigatorType({
      isAuthenticated: false,
      user: null,
      isLoading: false,
    });
    expect(navType).toBe('AUTH');
  });

  it('should dynamically resolve to PASSENGER when authenticated role is PASSENGER', () => {
    const navType = resolveNavigatorType({
      isAuthenticated: true,
      user: { ...baseUser, role: 'PASSENGER' },
      isLoading: false,
    });
    expect(navType).toBe('PASSENGER');
  });

  it('should dynamically resolve to DRIVER when authenticated role is DRIVER', () => {
    const navType = resolveNavigatorType({
      isAuthenticated: true,
      user: { ...baseUser, role: 'DRIVER', tenantId: 'tenant-123' },
      isLoading: false,
    });
    expect(navType).toBe('DRIVER');
  });

  it('should dynamically resolve to CONDUCTOR when authenticated role is CONDUCTOR', () => {
    const navType = resolveNavigatorType({
      isAuthenticated: true,
      user: { ...baseUser, role: 'CONDUCTOR', tenantId: 'tenant-123' },
      isLoading: false,
    });
    expect(navType).toBe('CONDUCTOR');
  });

  it('should dynamically resolve to OPERATOR_ADMIN when authenticated role is OPERATOR_ADMIN', () => {
    const navType = resolveNavigatorType({
      isAuthenticated: true,
      user: { ...baseUser, role: 'OPERATOR_ADMIN', tenantId: 'tenant-123' },
      isLoading: false,
    });
    expect(navType).toBe('OPERATOR_ADMIN');
  });
});
