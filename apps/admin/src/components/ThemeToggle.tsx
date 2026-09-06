import React from 'react';
import { useThemeStore } from '../stores/theme.store.js';

interface ThemeToggleProps {
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false }) => {
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? 'Switch to Dark Cybernetic Mode' : 'Switch to Ice White Mode'}
      aria-label="Toggle dark and light theme mode"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '6px 8px' : '6px 12px',
        backgroundColor: isLight ? 'rgba(241, 245, 249, 0.9)' : 'rgba(15, 23, 42, 0.8)',
        border: `1px solid ${isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)'}`,
        borderRadius: 9999,
        color: isLight ? '#0f172a' : '#f8fafc',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: isLight
          ? '0 1px 3px rgba(0, 0, 0, 0.08), inset 0 1px 1px #fff'
          : '0 2px 6px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.borderColor = isLight ? '#059669' : '#00D488';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.15)';
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{isLight ? '☀️' : '🌙'}</span>
      {!compact && (
        <span className="mobile-hide" style={{ letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
          {isLight ? 'Ice White' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
};
