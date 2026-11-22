// Per-tab stack preservation (native-style bottom tabs).
//
// Each bottom tab owns a "family" of routes. When the user leaves a tab for
// another tab, the route they were on is remembered in sessionStorage, so
// tapping the tab again returns to that screen instead of resetting to the
// tab root. Tapping the tab you are already on pops back to the tab root.
//
// Child screens belong to the family of the tab they were reached from, so
// e.g. a match opened from the Lobby lives in the Lobby stack.
export const TAB_FAMILIES = [
  { key: 'lobby', root: '/lobby', match: (p) => p === '/lobby' || p === '/find' || p === '/console' || p === '/create' || p.startsWith('/match/') },
  { key: 'leaderboard', root: '/leaderboard', match: (p) => p === '/leaderboard' },
  { key: 'bets', root: '/bets', match: (p) => p === '/bets' },
  { key: 'wallet', root: '/wallet', match: (p) => p === '/wallet' || p === '/crypto-settings' },
  { key: 'dashboard', root: '/dashboard', match: (p) => p === '/dashboard' || p === '/admin' },
  { key: 'home', root: '/', match: (p) => p === '/' },
];

const STACK_KEY = 'betthat-tab-stacks';

export function familyFor(pathname) {
  return TAB_FAMILIES.find((f) => f.match(pathname)) || null;
}

function readStacks() {
  try {
    return JSON.parse(window.sessionStorage.getItem(STACK_KEY) || '{}');
  } catch {
    return {};
  }
}

export function rememberRoute(pathname) {
  const family = familyFor(pathname);
  if (!family) return;
  try {
    const stacks = readStacks();
    stacks[family.key] = pathname;
    window.sessionStorage.setItem(STACK_KEY, JSON.stringify(stacks));
  } catch {
    // storage unavailable — stack memory is best-effort
  }
}

export function stackedRouteFor(tabKey) {
  return readStacks()[tabKey] || null;
}

export function tabRootFor(tabKey) {
  const family = TAB_FAMILIES.find((f) => f.key === tabKey);
  return family ? family.root : '/';
}
