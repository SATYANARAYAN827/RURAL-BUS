import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/auth.store.js';
import { AuthNavigator } from './AuthNavigator.js';
import { PassengerNavigator } from './PassengerNavigator.js';
import { DriverNavigator } from './DriverNavigator.js';
import { ConductorNavigator } from './ConductorNavigator.js';
import { colors, spacing } from '@ruralbus/ui';
import type { AuthUser } from '@ruralbus/shared-types';

export type NavigatorType =
  | 'LOADING'
  | 'AUTH'
  | 'PASSENGER'
  | 'DRIVER'
  | 'CONDUCTOR'
  | 'OPERATOR_ADMIN';

/**
 * Pure role & authentication resolution function.
 * Deterministically resolves which navigator flow to display based strictly on verified JWT claims.
 */
export function resolveNavigatorType(params: {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
}): NavigatorType {
  if (params.isLoading) {
    return 'LOADING';
  }

  if (!params.isAuthenticated || !params.user) {
    return 'AUTH';
  }

  switch (params.user.role) {
    case 'PASSENGER':
      return 'PASSENGER';
    case 'DRIVER':
      return 'DRIVER';
    case 'CONDUCTOR':
      return 'CONDUCTOR';
    case 'OPERATOR_ADMIN':
      return 'OPERATOR_ADMIN';
    default:
      return 'AUTH';
  }
}

export function RootNavigator() {
  const { user, isAuthenticated, isLoading, initialize, logout } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const navType = resolveNavigatorType({ isAuthenticated, user, isLoading });

  if (navType === 'LOADING') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: colors.background.primary,
          color: colors.brand.primary,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 32, marginBottom: spacing.sm }}>🚌</div>
        <div style={{ fontSize: 18, fontWeight: 'bold' }}>RuralBus</div>
        <div style={{ fontSize: 12, color: colors.text.secondary, marginTop: 4 }}>
          Initializing secure session...
        </div>
      </div>
    );
  }

  switch (navType) {
    case 'PASSENGER':
      return <PassengerNavigator />;

    case 'DRIVER':
      return <DriverNavigator />;

    case 'CONDUCTOR':
      return <ConductorNavigator />;

    case 'OPERATOR_ADMIN':
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: colors.background.primary,
            color: colors.text.primary,
            padding: spacing.xl,
            textAlign: 'center',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: spacing.md }}>💻</div>
          <h2 style={{ fontSize: 20, color: colors.brand.primary }}>Operator Admin Account</h2>
          <p style={{ color: colors.text.secondary, maxWidth: 360, marginTop: 8, fontSize: 14 }}>
            Operator administrative functions are managed via the RuralBus Web Dashboard on desktop browsers.
          </p>
          <button
            onClick={logout}
            style={{
              marginTop: spacing.lg,
              padding: '10px 20px',
              backgroundColor: colors.background.secondary,
              border: `1px solid ${colors.border.subtle}`,
              color: colors.text.primary,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Log Out
          </button>
        </div>
      );

    case 'AUTH':
    default:
      return <AuthNavigator />;
  }
}
