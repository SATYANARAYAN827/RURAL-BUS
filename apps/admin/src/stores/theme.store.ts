import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'ruralbus_theme';

export const useThemeStore = create<ThemeState>((set, get) => {
  // Default to 'light' (Ice White) as requested by user
  let initialTheme: ThemeMode = 'light';
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') {
      initialTheme = saved;
    }
  }

  // Apply immediately to HTML document
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', initialTheme);
    if (initialTheme === 'light') {
      document.documentElement.classList.add('theme-ice-white');
      document.documentElement.classList.remove('theme-dark');
    } else {
      document.documentElement.classList.add('theme-dark');
      document.documentElement.classList.remove('theme-ice-white');
    }
  }

  return {
    theme: initialTheme,
    setTheme: (theme: ThemeMode) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, theme);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'light') {
          document.documentElement.classList.add('theme-ice-white');
          document.documentElement.classList.remove('theme-dark');
        } else {
          document.documentElement.classList.add('theme-dark');
          document.documentElement.classList.remove('theme-ice-white');
        }
      }
      set({ theme });
    },
    toggleTheme: () => {
      const next = get().theme === 'light' ? 'dark' : 'light';
      get().setTheme(next);
    },
  };
});
