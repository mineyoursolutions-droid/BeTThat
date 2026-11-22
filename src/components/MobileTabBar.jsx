import { NavLink } from 'react-router-dom';
import { LayoutGrid, Trophy, Receipt, Wallet, Plus } from 'lucide-react';

const TABS = [
  { label: 'Lobby', to: '/lobby', icon: LayoutGrid },
  { label: 'Ranks', to: '/leaderboard', icon: Trophy },
  { label: 'Wagers', to: '/bets', icon: Receipt },
  { label: 'Wallet', to: '/wallet', icon: Wallet },
];

export default function MobileTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="no-select fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {TABS.slice(0, 2).map((tab) => (
          <Tab key={tab.to} {...tab} />
        ))}
        <NavLink
          to="/create"
          className="mx-auto -mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary via-primary to-win text-primary-foreground shadow-[0_12px_28px_-10px_hsl(187_88%_55%/0.9)]"
          aria-label="Post a challenge"
        >
          <Plus className="h-5 w-5" strokeWidth={2.6} />
        </NavLink>
        {TABS.slice(2).map((tab) => (
          <Tab key={tab.to} {...tab} />
        ))}
      </div>
    </nav>
  );
}

function Tab({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-semibold uppercase tracking-[0.1em] transition ${
          isActive ? 'text-primary' : 'text-muted-foreground'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      {label}
    </NavLink>
  );
}