import React from 'react';
import { useAuthStore } from '../../stores/auth.store.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';

export function PassengerProfileScreen() {
  const { user, logout } = useAuthStore();

  return (
    <div style={{ padding: spacing.lg, color: colors.text.primary }}>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: '0 0 16px 0' }}>Passenger Profile</h1>

      <div
        style={{
          backgroundColor: colors.background.secondary,
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.border.subtle}`,
          padding: spacing.lg,
          marginBottom: spacing.lg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%', backgroundColor: colors.brand.primary, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 'bold' }}>
            {user?.fullName?.charAt(0) || 'P'}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>{user?.fullName}</div>
            <div style={{ fontSize: 13, color: colors.text.secondary }}>{user?.phone}</div>
            {user?.email && <div style={{ fontSize: 12, color: colors.text.secondary }}>{user?.email}</div>}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${colors.border.subtle}`, paddingTop: spacing.md }}>
          <div style={{ fontSize: 12, color: colors.text.secondary }}>Operational Role</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.brand.primary, marginTop: 2 }}>
            {user?.role}
          </div>
        </div>
      </div>

      <button
        onClick={logout}
        style={{
          width: '100%',
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: colors.status.error,
          fontWeight: 600,
          fontSize: 14,
          border: `1px solid ${colors.status.error}`,
          borderRadius: borderRadius.md,
          cursor: 'pointer',
        }}
      >
        Log Out
      </button>
    </div>
  );
}
