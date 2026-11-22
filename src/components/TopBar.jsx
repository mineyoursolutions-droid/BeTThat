import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Plus, LogOut, ShieldCheck, Moon, Sun } from 'lucide-react';
import DeleteAccount from '@/components/DeleteAccount';
import { getThemePreference, setThemePreference } from '@/lib/theme';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import CoinMark from '@/components/CoinMark';
import { Image } from '@/components/ui/image';
import { fmtUsd, toUsd } from '@/lib/demo';
import { BRAND_LOGO, BRAND_NAME } from '@/lib/brand';

const NAV = [
  { label: 'Lobby', to: '/lobby' },
  { label: 'Find a game', to: '/find' },
  { label: 'Console bridge', to: '/console' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'My wagers', to: '/bets' },
  { label: 'My stats', to: '/dashboard' },
  { label: 'Wallet', to: '/wallet' },
];

export default function TopBar() {
  const { user, logout } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [theme, setTheme] = useState(() => getThemePreference());

  const cycleTheme = () => {
    // system -> dark -> light -> system; the OS preference is honoured by default
    const next = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
    setTheme(next);
    setThemePreference(next);
  };

  useEffect(() => {
    if (!user) {
      setWallets([]);
      return;
    }
    base44.entities.Wallet.filter({ user_id: user.id }, { limit: 20 }).then((page) => setWallets(page.items || []));
  }, [user]);

  const total = wallets.reduce((sum, w) => sum + toUsd(w.available, w.coin), 0);
  const handle = (user && (user.full_name || String(user.email).split('@')[0])) || '';

  return (
    <header className="safe-top no-select relative z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl md:sticky md:top-0">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5 sm:px-8 md:h-16">
        <Link to="/" className="flex shrink-0 items-center" aria-label={BRAND_NAME}>
          <Image
            src={BRAND_LOGO}
            alt={BRAND_NAME}
            className="brand-logo h-11 w-[116px] mix-blend-screen"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                  isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user && user.role === 'admin' ? (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                  isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-primary'
                }`
              }
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Desk
            </NavLink>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {user ? (
            <>
              <Link
                to="/wallet"
                className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 transition hover:border-primary/40 sm:flex"
              >
                <CoinMark ticker="USDT" size="sm" />
                <span className="nums text-[12.5px] font-semibold text-foreground">{fmtUsd(total)}</span>
                <span className="h-3.5 w-px bg-border" />
                <span className="text-[12px] font-semibold text-primary">Fund</span>
              </Link>

              <Link
                to="/create"
                className="hidden items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition hover:brightness-105 sm:flex"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
                Post
              </Link>

              <span className="hidden max-w-[110px] truncate text-[12.5px] font-semibold text-foreground lg:block">
                {handle}
              </span>
              <button
                type="button"
                onClick={cycleTheme}
                aria-label={`Theme: ${theme}. Tap to change.`}
                title={`Theme: ${theme}`}
                className="grid h-11 w-11 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary md:h-8 md:w-8"
              >
                {theme === 'light' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
              <DeleteAccount className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-destructive/40 px-2.5 text-[11px] font-semibold text-destructive transition hover:bg-destructive/10 md:min-h-0 md:h-8" />
              <button
                type="button"
                onClick={() => logout()}
                aria-label="Sign out"
                className="grid h-11 w-11 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary md:h-8 md:w-8"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/create"
                className="hidden items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition hover:brightness-105 sm:flex"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
                Post a challenge
              </Link>
              <Link
                to="/login"
                className="rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}