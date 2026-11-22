// Theme for the app shell.
//
// BetThat is a dark-only app: the whole visual system (asphalt
// background, neon spray-paint accents, graffiti display type) is built
// on the dark token set, so the app always renders dark regardless of
// the device's OS light/dark preference. The previous 'system' default
// followed the OS, which is why the live site read light (white /
// light-pink grid) on light-system devices instead of dark.
//
// The exported API is kept so existing callers (main.jsx) do not break;
// every path now resolves to 'dark' and no OS listener is attached.

const STORAGE_KEY = 'betthat-theme';

export function getThemePreference() {
  return 'dark';
}

export function resolveTheme() {
  return 'dark';
}

export function applyTheme() {
  document.documentElement.classList.add('dark');
  document.documentElement.style.colorScheme = 'dark';
  return 'dark';
}

export function initTheme() {
  // Clear any stale light/system choice from before the dark-only switch.
  try {
    window.localStorage.setItem(STORAGE_KEY, 'dark');
  } catch {
    // storage unavailable — the class is applied regardless
  }
  applyTheme();
  return 'dark';
}

export function setThemePreference() {
  // Dark-only: an explicit choice is a no-op, the app stays dark.
  return applyTheme();
}
