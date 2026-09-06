export const themeTokens = {
  colors: {
    primary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    brand: {
      primary: '#16a34a',
      primaryDark: '#14532d',
      primaryLight: '#dcfce7',
      accent: '#22c55e',
      busOrange: '#ea580c',
      busNavy: '#0f172a',
      busEmerald: '#10b981',
      darkSurface: '#14291c',
      darkCard: '#1e3827',
    },
    background: {
      primary: '#f2f6f3',      // Soft countryside sage / light cream
      secondary: '#ffffff',    // Crisp white card surfaces
      tertiary: '#edf3ee',     // Soft rounded input backgrounds
      elevated: '#ffffff',
      dark: '#14291c',
      greenPill: '#166534',
    },
    text: {
      primary: '#14291c',      // Dark forest charcoal for high legibility
      secondary: '#526b5a',    // Muted green-slate for labels
      tertiary: '#7d9484',     // Light grey-green for hints
      inverse: '#ffffff',      // White text on green/dark surfaces
      brand: '#16a34a',
    },
    border: {
      subtle: '#e0eae2',
      focus: '#16a34a',
      strong: '#b8cec0',
    },
    neutral: {
      50: '#f8faf9',
      100: '#f1f5f2',
      200: '#e2eae4',
      300: '#cbd8cf',
      500: '#64748b',
      700: '#334155',
      900: '#0f172a',
    },
    status: {
      active: '#16a34a',
      delayed: '#d97706',
      cancelled: '#dc2626',
      boarding: '#2563eb',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#0284c7',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: {
    sm: '0.375rem',  // 6px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    full: '9999px',
  },
  shadows: {
    subtle: '0 1px 3px rgba(20, 41, 28, 0.05)',
    card: '0 4px 12px -2px rgba(20, 41, 28, 0.06), 0 2px 6px -1px rgba(20, 41, 28, 0.04)',
    elevated: '0 10px 25px -5px rgba(20, 41, 28, 0.1), 0 8px 10px -6px rgba(20, 41, 28, 0.05)',
    glow: '0 0 20px rgba(34, 197, 94, 0.25)',
  },
};

export const colors = themeTokens.colors;
export const spacing = themeTokens.spacing;
export const borderRadius = themeTokens.borderRadius;
export const shadows = themeTokens.shadows;
