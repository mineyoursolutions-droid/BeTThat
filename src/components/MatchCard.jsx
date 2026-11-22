import { Link } from 'react-router-dom';
import { Users, ArrowUpRight } from 'lucide-react';
import CoinMark from '@/components/CoinMark';
import MatchSide from '@/components/MatchSide';
import StatusPill from '@/components/StatusPill';
import { fmtCoin, fmtUsd, toUsd } from '@/lib/demo';
import { gameLook } from '@/lib/matches';

export default function MatchCard({ match }) {
  const game = gameLook(match.game);
  const stakeUsd = toUsd(match.stake.amount, match.stake.ticker);

  return (
    <Link
      to={`/match/${match.id}`}
      className="no-select group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]"
    >
      <div className={`h-[3px] w-full bg-gradient-to-r ${game.gradient}`} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
              {game.monogram}
            </span>
            <span className="truncate text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{game.name}</span>
          </div>
          <StatusPill status={match.status} />
        </div>

        <div>
          <h3 className="flex items-center gap-1.5 text-[17px] font-semibold leading-tight text-foreground">
            {match.title}
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{match.detail}</p>
        </div>

        <div className="mt-auto grid grid-cols-[1fr_auto_1fr] items-center gap-1 rounded-xl border border-border/70 bg-background/60 p-1">
          <MatchSide player={match.creator} odds={match.market.creator} />
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">vs</span>
          <MatchSide player={match.challenger} odds={match.market.challenger} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
          <div className="flex min-w-0 items-baseline gap-2">
            <CoinMark ticker={match.stake.ticker} size="sm" />
            <span className="nums text-[13px] font-semibold text-foreground">{fmtCoin(match.stake.amount, match.stake.ticker)}</span>
            <span className="nums hidden text-[11px] text-muted-foreground sm:inline">≈ {fmtUsd(stakeUsd)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {match.spectators}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}