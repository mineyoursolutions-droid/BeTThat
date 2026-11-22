// Theme preference for the app shell.
//
// Modes: 'system' (follow the OS light/dark preference, the default),
// 'dark' or 'light' (explicit user choice, stored in localStorage).
// The app ships dark-first, but a light-system device now gets the light
// token set instead of a forced dark UI — the Google Play dark-mode
// requirement is "system preference adaptation", not "dark only".

const STORAGE_KEY = 'betthat-theme';

export function getThemePreference() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  } catch {
    // storage unavailable — fall through to system
  }
  return 'system';
}

export function resolveTheme(preference) {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(preference) {
  const theme = resolveTheme(preference);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  return theme;
}

export function initTheme() {
  const preference = getThemePreference();
  applyTheme(preference);
  // Keep following the OS while the user has not picked explicitly.
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (getThemePreference() === 'system') applyTheme('system');
    });
  }
  return preference;
}

export function setThemePreference(preference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // storage unavailable — still apply for this session
  }
  return applyTheme(preference);
}
