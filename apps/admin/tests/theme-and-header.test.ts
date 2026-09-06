import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../src/stores/theme.store.js';

class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Setup global mock for node environment
const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = { localStorage: mockStorage };

const mockDocumentElement = {
  attributes: new Map<string, string>(),
  classList: {
    classes: new Set<string>(),
    add(cls: string) { this.classes.add(cls); },
    remove(cls: string) { this.classes.delete(cls); },
    contains(cls: string) { return this.classes.has(cls); },
  },
  setAttribute(attr: string, val: string) {
    this.attributes.set(attr, val);
  },
  getAttribute(attr: string) {
    return this.attributes.get(attr) ?? null;
  },
};
(globalThis as any).document = {
  documentElement: mockDocumentElement,
};

describe('Ice White Theme & Upper Toggle Store', () => {
  beforeEach(() => {
    mockStorage.clear();
    useThemeStore.getState().setTheme('light');
  });

  it('A. Defaults to "light" (Ice White mode) upon initialization', () => {
    const store = useThemeStore.getState();
    expect(store.theme).toBe('light');
    expect(mockDocumentElement.getAttribute('data-theme')).toBe('light');
    expect(mockDocumentElement.classList.contains('theme-ice-white')).toBe(true);
  });

  it('B. Toggles smoothly between Dark Mode and Ice White Mode', () => {
    const store = useThemeStore.getState();

    // Toggle to Dark
    store.toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(mockStorage.getItem('ruralbus_theme')).toBe('dark');
    expect(mockDocumentElement.getAttribute('data-theme')).toBe('dark');
    expect(mockDocumentElement.classList.contains('theme-dark')).toBe(true);
    expect(mockDocumentElement.classList.contains('theme-ice-white')).toBe(false);

    // Toggle back to Ice White
    store.toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(mockStorage.getItem('ruralbus_theme')).toBe('light');
    expect(mockDocumentElement.getAttribute('data-theme')).toBe('light');
    expect(mockDocumentElement.classList.contains('theme-ice-white')).toBe(true);
  });

  it('C. Explicitly setting theme persists correctly to localStorage and document element', () => {
    const store = useThemeStore.getState();

    store.setTheme('dark');
    expect(mockStorage.getItem('ruralbus_theme')).toBe('dark');
    expect(mockDocumentElement.getAttribute('data-theme')).toBe('dark');

    store.setTheme('light');
    expect(mockStorage.getItem('ruralbus_theme')).toBe('light');
    expect(mockDocumentElement.getAttribute('data-theme')).toBe('light');
  });
});
