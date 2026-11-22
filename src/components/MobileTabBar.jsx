import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, Trophy, Receipt, Wallet, Plus } from 'lucide-react';
import { familyFor, stackedRouteFor } from '@/lib/tabStacks';

const TABS = [
  { label: 'Lobby', to: '/lobby', icon: LayoutGrid, family: 'lobby' },
  { label: 'Ranks', to: '/leaderboard', icon: Trophy, family: 'leaderboard' },
  { label: 'Wagers', to: '/bets', icon: Receipt, family: 'bets' },
  { label: 'Wallet', to: '/wallet', icon: Wallet, family: 'wallet' },
];

export default function MobileTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const currentFamily = familyFor(pathname);

  // Per-tab stack preservation (native tab behaviour):
  // - tapping a different tab returns to the screen that tab was last on
  //   (e.g. back to the match you were reading in the Lobby stack);
  // - tapping the tab you are already on pops its stack back to the root.
  const handleTab = (event, tab) => {
    event.preventDefault();
    if (currentFamily && currentFamily.key === tab.family) {
      if (pathname !== tab.to) navigate(tab.to);
      return;
    }
    const stacked = stackedRouteFor(tab.family);
    navigate(stacked && stacked !== pathname ? stacked : tab.to);
  };

  return (
    <nav
      aria-label="Primary"
      className="no-select fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {TABS.slice(0, 2).map((tab) => (
          <Tab key={tab.to} {...tab} onTap={handleTab} />
        ))}
        <NavLink
          to="/create"
          className="mx-auto -mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary via-primary to-win text-primary-foreground shadow-[0_12px_28px_-10px_hsl(187_88%_55%/0.9)]"
          aria-label="Post a challenge"
        >
          <Plus className="h-5 w-5" strokeWidth={2.6} />
        </NavLink>
        {TABS.slice(2).map((tab) => (
          <Tab key={tab.to} {...tab} onTap={handleTab} />
        ))}
      </div>
    </nav>
  );
}

function Tab({ to, label, icon: Icon, family, onTap }) {
  // A tab stays highlighted while the user is anywhere in its stack
  // (e.g. Lobby stays active on a match detail opened from the lobby).
  const { pathname } = useLocation();
  const isActive = familyFor(pathname)?.key === family;
  return (
    <NavLink
      to={to}
      onClick={(event) => onTap(event, { to, label, family })}
      aria-current={isActive ? 'page' : undefined}
      className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-sm font-semibold uppercase tracking-[0.05em] transition ${
        isActive ? 'text-primary' : 'text-muted-foreground'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      {label}
    </NavLink>
  );
}
