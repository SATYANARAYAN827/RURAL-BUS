import React from 'react';
import { useAdminAuthStore } from '../../stores/auth.store.js';
import type { AuthUser } from '@ruralbus/shared-types';

export type AdminAccessStatus =
  | 'LOADING'
  | 'UNAUTHENTICATED'
  | 'AUTHORIZED'
  | 'FORBIDDEN';

/**
 * Pure authorization evaluation helper.
 * Allows verified identities across all roles (Passenger, Driver, Conductor, Operator Admin)
 * into their corresponding RuralBus portal views.
 */
export function resolveAdminAccessStatus(params: {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
}): AdminAccessStatus {
  if (params.isLoading) {
    return 'LOADING';
  }
  if (!params.isAuthenticated || !params.user) {
    return 'UNAUTHENTICATED';
  }
  if (
    params.user.role === 'OPERATOR_ADMIN' ||
    params.user.role === 'DRIVER' ||
    params.user.role === 'PASSENGER' ||
    params.user.role === 'CONDUCTOR' ||
    params.user.role === 'PLATFORM_ADMIN'
  ) {
    return 'AUTHORIZED';
  }
  return 'FORBIDDEN';
}

interface RoleGuardProps {
  children: React.ReactNode;
  fallbackLogin: React.ReactNode;
}

export function RoleGuard({ children, fallbackLogin }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAdminAuthStore();

  const status = resolveAdminAccessStatus({ isAuthenticated, user, isLoading });

  if (status === 'LOADING') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f1f5f1',
          color: '#14532d',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }}>🚌</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#14532d' }}>
          RURAL <span style={{ color: '#16a34a' }}>BUS</span>
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Loading your transit portal...
        </div>
      </div>
    );
  }

  if (status === 'UNAUTHENTICATED') {
    return <>{fallbackLogin}</>;
  }

  return <>{children}</>;
}
