import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { fmtCoin } from '@/lib/demo';

export default function Leaderboard() {
  const [players, setPlayers] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke('getLeaderboard', {})
      .then((res) => setPlayers(res.data.players || []))
      .catch(() => setPlayers([]));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Season standings</p>
      <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[38px]">
        The players carrying the book
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
        Ranked by verified wins across settled matches, with volume counted in the coin each player stakes most.
      </p>

      {players === null ? (
        <div className="mt-8 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <Trophy className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-4 text-[15px] font-semibold text-foreground">The table is empty.</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            Standings start moving once matches are settled by an operator.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[48px_1.5fr_1fr_0.7fr_0.7fr_1fr] gap-4 border-b border-border px-5 py-3 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground md:grid">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Matches</span>
            <span className="text-right">W–L</span>
            <span className="text-right">Win %</span>
            <span className="text-right">Volume</span>
          </div>
          {players.map((p, i) => (
            <div
              key={p.user_id}
              className="grid grid-cols-[32px_1fr_auto] items-center gap-4 border-b border-border/60 px-5 py-4 last:border-0 md:grid-cols-[48px_1.5fr_1fr_0.7fr_0.7fr_1fr]"
            >
              <span className={`nums text-[13px] font-semibold ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="truncate text-[13.5px] font-semibold text-foreground">{p.handle}</p>
              <p className="nums hidden text-right text-[12.5px] text-muted-foreground md:block">{p.matches}</p>
              <p className="nums hidden text-right text-[12.5px] text-foreground/85 md:block">
                {p.wins}–{p.losses}
              </p>
              <p className="nums hidden text-right text-[12.5px] text-foreground/85 md:block">{p.win_rate}%</p>
              <p className="nums text-right text-[12.5px] font-semibold text-foreground">
                {fmtCoin(p.volume, p.volume_coin)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}