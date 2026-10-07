export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'kit-theme';

function apply(theme: ThemePreference): void {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/** Set the theme ('light' | 'dark' | 'system') and persist the choice. */
export function setTheme(theme: ThemePreference): void {
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode — theme stays for this page only */
  }
  window.dispatchEvent(new CustomEvent('kit:themechange', { detail: { theme } }));
}

/** Current preference (falls back to 'system'). */
export function getTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* ignore */
  }
  return 'system';
}

/** Apply the persisted preference as early as possible (avoids theme flash). */
export function initTheme(): void {
  apply(getTheme());
}
