import { Users, Radio } from 'lucide-react';
import CoinMark from '@/components/CoinMark';
import { gameBySlug, fmtCoin, fmtUsd, toUsd } from '@/lib/demo';

const MATCH = {
  game: 'cod',
  title: 'Search & Destroy · Best of 7',
  creator: { handle: 'VexNova', record: '148–62' },
  challenger: { handle: 'GlassCleaner', record: '211–94' },
  odds: { creator: 1.62, challenger: 2.35 },
  split: 62,
  spectators: 412,
  stake: { amount: 0.0042, ticker: 'BTC' },
};

export default function HeroTicket() {
  const game = gameBySlug(MATCH.game);
  const usd = toUsd(MATCH.stake.amount, MATCH.stake.ticker);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-gradient-to-br from-primary/12 via-transparent to-win/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[1.5rem] border border-border bg-card/85 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <div className={`h-[3px] w-full bg-gradient-to-r ${game.gradient}`} />
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
                {game.monogram}
              </span>
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{game.name}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-live/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-live ring-1 ring-inset ring-live/30">
              <Radio className="h-3 w-3" />
              Sample market
            </span>
          </div>

          <h3 className="mt-4 text-[19px] font-semibold leading-snug text-foreground">{MATCH.title}</h3>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { ...MATCH.creator, odds: MATCH.odds.creator, side: 'Creator' },
              { ...MATCH.challenger, odds: MATCH.odds.challenger, side: 'Challenger' },
            ].map((p) => (
              <div key={p.handle} className="rounded-xl border border-border/80 bg-background/60 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{p.side}</p>
                <p className="mt-1.5 truncate text-[13px] font-semibold text-foreground">{p.handle}</p>
                <p className="nums mt-0.5 text-[11px] text-muted-foreground">{p.record}</p>
                <p className="nums mt-2 text-[15px] font-semibold text-primary">{p.odds.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Spectator market</span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {MATCH.spectators} on it
              </span>
            </div>
            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${MATCH.split}%` }} />
              <div className="h-full bg-win" style={{ width: `${100 - MATCH.split}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold">
              <span className="text-primary">{MATCH.split}% creator</span>
              <span className="text-win">{100 - MATCH.split}% challenger</span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border border-border/80 bg-background/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CoinMark ticker={MATCH.stake.ticker} size="sm" />
              <span className="nums text-[13px] font-semibold text-foreground">
                {fmtCoin(MATCH.stake.amount, MATCH.stake.ticker)}
              </span>
            </div>
            <span className="nums text-[11px] text-muted-foreground">≈ {fmtUsd(usd)}</span>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 hidden rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-xl sm:block">
        <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Settled</p>
        <p className="nums mt-0.5 text-[12px] font-semibold text-win">+0.0084 BTC paid</p>
      </div>
    </div>
  );
}