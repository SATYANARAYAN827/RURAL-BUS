import React from 'react';
import { ThemeToggle } from '../ThemeToggle.js';
import { useThemeStore } from '../../stores/theme.store.js';

export interface TopHeaderProps {
  icon: string;
  roleBadge: string;
  roleBadgeColor?: string;
  roleBadgeBg?: string;
  portalTitle: string;
  portalSubtitle?: string;
  activeViewTitle?: string;
  isMobileNavOpen?: boolean;
  onToggleMobileNav?: () => void;
  unreadNotifsCount?: number;
  onOpenNotifs?: () => void;
  extraActions?: React.ReactNode;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  icon,
  roleBadge,
  roleBadgeColor = '#00D488',
  roleBadgeBg = 'rgba(0, 212, 136, 0.15)',
  portalTitle,
  portalSubtitle,
  activeViewTitle,
  isMobileNavOpen = false,
  onToggleMobileNav,
  unreadNotifsCount,
  onOpenNotifs,
  extraActions,
}) => {
  const { theme } = useThemeStore();
  const isLight = theme === 'light';

  return (
    <header
      className="fixed-top-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: 60,
        width: '100%',
        backgroundColor: isLight ? 'rgba(248, 250, 252, 0.92)' : 'rgba(5, 10, 15, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${isLight ? 'rgba(203, 213, 225, 0.8)' : 'rgba(255, 255, 255, 0.08)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(12px, 2.5vw, 24px)',
        boxSizing: 'border-box',
        boxShadow: isLight
          ? '0 4px 20px -2px rgba(15, 23, 42, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.02)'
          : '0 4px 20px rgba(0, 0, 0, 0.5)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Left: Mobile Nav Button + Brand & Portal Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="mobile-nav-toggle-btn"
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            style={{
              padding: '6px 10px',
              backgroundColor: isLight ? 'rgba(241, 245, 249, 0.9)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)'}`,
              borderRadius: 8,
              color: isLight ? '#0f172a' : '#ffffff',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'none', // Controlled by CSS media query
              alignItems: 'center',
              gap: 4,
            }}
          >
            {isMobileNavOpen ? '✕' : '☰'}
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: roleBadgeBg,
              border: `1px solid ${roleBadgeColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
            }}
          >
            {icon}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  letterSpacing: -0.3,
                  color: isLight ? '#0f172a' : '#ffffff',
                }}
              >
                RURAL<span style={{ color: '#00D488' }}>BUS</span>
              </span>
              <span
                style={{
                  fontSize: 10,
                  background: roleBadgeBg,
                  color: roleBadgeColor,
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                }}
              >
                {roleBadge}
              </span>

              {activeViewTitle && (
                <span
                  className="desktop-header-title-badge"
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: isLight ? '#047857' : '#00D488',
                    backgroundColor: isLight ? '#ecfdf5' : 'rgba(0, 212, 136, 0.12)',
                    border: `1px solid ${isLight ? '#a7f3d0' : 'rgba(0, 212, 136, 0.3)'}`,
                    padding: '2px 8px',
                    borderRadius: 6,
                    letterSpacing: 0.2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ opacity: 0.5 }}>›</span>
                  <span>{activeViewTitle}</span>
                </span>
              )}
            </div>

            <span
              className="desktop-header-subtitle"
              style={{
                fontSize: 11,
                color: isLight ? '#64748b' : '#94a3b8',
                fontWeight: 600,
                marginTop: -1,
              }}
            >
              {portalSubtitle || portalTitle}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Theme Toggle (Dark / Ice White) + Notifications + Action Slots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {extraActions}

        {onOpenNotifs && (
          <button
            type="button"
            onClick={onOpenNotifs}
            title="Notifications"
            style={{
              padding: '6px 10px',
              backgroundColor:
                (unreadNotifsCount ?? 0) > 0
                  ? 'rgba(245, 158, 11, 0.15)'
                  : isLight
                    ? 'rgba(241, 245, 249, 0.9)'
                    : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${
                (unreadNotifsCount ?? 0) > 0
                  ? '#f59e0b'
                  : isLight
                    ? '#cbd5e1'
                    : 'rgba(255, 255, 255, 0.12)'
              }`,
              borderRadius: 8,
              color: (unreadNotifsCount ?? 0) > 0 ? '#d97706' : isLight ? '#475569' : '#cbd5e1',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>🔔</span>
            {(unreadNotifsCount ?? 0) > 0 && <span>{unreadNotifsCount}</span>}
          </button>
        )}

        {/* ☀️ / 🌙 Upper Theme Toggle for Dark & Ice White Mode */}
        <ThemeToggle />
      </div>
    </header>
  );
};
