import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { BRAND_LOGO, BRAND_NAME } from '@/lib/brand';

const LINKS = [
  { label: 'Lobby', to: '/lobby' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'Wallet', to: '/wallet' },
  { label: 'Post a challenge', to: '/create' },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Delete Account', to: '/account-deletion' },
];

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-ink">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <Image
              src={BRAND_LOGO}
              alt={BRAND_NAME}
              className="brand-logo h-14 w-[148px] mix-blend-screen"
            />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Head-to-head wagers across console and PC titles, settled in crypto. Players stake, spectators take a side,
              every payout is recorded in the open ledger.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-16">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Play</p>
              <ul className="mt-4 space-y-2.5">
                {LINKS.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-foreground/80 transition hover:text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Legal</p>
              <ul className="mt-4 space-y-2.5">
                {LEGAL_LINKS.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-foreground/80 transition hover:text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Funding</p>
              <ul className="mt-4 space-y-2.5 text-sm text-foreground/80">
                <li>Bitcoin</li>
                <li>Tether (USDT)</li>
                <li>USD Coin (USDC)</li>
                <li>Ethereum</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            18+ only. Wagering involves risk of loss. Stakes are held in escrow until a match is settled and verified by
            an official result. Playing for money may be restricted or require a licence in your jurisdiction — check
            your local rules before you fund a wallet. Balances are held per-account and payouts are released by the
            operator.
          </p>
          <p className="mt-4 text-sm text-muted-foreground/70">© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}