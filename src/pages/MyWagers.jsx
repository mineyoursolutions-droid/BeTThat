import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import CoinMark from '@/components/CoinMark';
import { fmtCoin } from '@/lib/demo';
import { gameLook } from '@/lib/matches';
import PullToRefresh from '@/components/mobile/PullToRefresh';

const STATUS_STYLE = {
  locked: 'text-primary',
  won: 'text-win',
  lost: 'text-muted-foreground',
  refunded: 'text-muted-foreground',
};

export default function MyWagers() {
  const { user } = useAuth();
  const [wagers, setWagers] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    const page = await base44.entities.Wager.filter({ user_id: user.id }, { sort: '-created_date', limit: 100 });
    setWagers(page.items || []);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PullToRefresh onRefresh={load}>
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">My wagers</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[38px]">
          Every side you've taken
        </h1>
        <Link
          to="/dashboard"
          className="rounded-full border border-border px-3.5 py-2 text-[12.5px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        >
          My stats
        </Link>
      </div>

      {wagers === null ? (
        <div className="mt-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : wagers.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-[15px] font-semibold text-foreground">Nothing on the books yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            Accept a challenge or back a side from the sideline and it will show up here.
          </p>
          <Link
            to="/lobby"
            className="mt-6 inline-block rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
          >
            Open the lobby
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {wagers.map((w) => {
            const game = gameLook(w.game_slug);
            return (
              <Link
                key={w.id}
                to={`/match/${w.match_id}`}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition hover:border-primary/35"
              >
                <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {game.monogram}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-foreground">{w.match_title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {w.kind === 'player' ? 'Player challenge' : 'Spectator'} · {w.side} side
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CoinMark ticker={w.coin} size="sm" />
                  <span className="nums text-[13px] font-semibold text-foreground">{fmtCoin(w.amount, w.coin)}</span>
                </div>
                <div className="w-24 text-right">
                  <p className={`text-[10.5px] font-semibold uppercase tracking-[0.12em] ${STATUS_STYLE[w.status] || ''}`}>
                    {w.status}
                  </p>
                  {Number(w.payout) > 0 ? (
                    <p className="nums text-[12px] font-semibold text-win">+{fmtCoin(w.payout, w.coin)}</p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}