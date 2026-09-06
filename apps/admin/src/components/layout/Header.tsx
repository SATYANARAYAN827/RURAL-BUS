import { useAdminAuthStore } from '../../stores/auth.store.js';
import { colors, spacing, borderRadius } from '@ruralbus/ui';

interface HeaderProps {
  activeViewTitle: string;
}

export function Header({ activeViewTitle }: HeaderProps) {
  const { user, tenant, logout } = useAdminAuthStore();

  return (
    <header
      style={{
        height: 64,
        backgroundColor: '#ffffff',
        borderBottom: `1px solid ${colors.border.subtle}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${spacing.xl}`,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: colors.text.primary, margin: 0 }}>
          {activeViewTitle}
        </h2>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
        {/* Tenant/Depot Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#f0fdf4',
            padding: '6px 14px',
            borderRadius: borderRadius.full,
            border: `1.5px solid #bbf7d0`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#16a34a',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
            {tenant?.name || 'Transit Operator'}
          </span>
          {(tenant as any)?.corridor && (
            <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>
              ({(tenant as any).corridor})
            </span>
          )}
        </div>

        {/* User Profile & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text.primary }}>
              {user?.fullName || 'Suresh Kumar'}
            </div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
              {user?.role}
            </div>
          </div>

          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#e6f4ea',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              border: '1.5px solid #cce8d4',
            }}
          >
            {user?.fullName?.charAt(0) || 'S'}
          </div>

          <button
            onClick={logout}
            title="Log Out"
            style={{
              padding: '6px 12px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              border: `1px solid #fecaca`,
              borderRadius: borderRadius.md,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
