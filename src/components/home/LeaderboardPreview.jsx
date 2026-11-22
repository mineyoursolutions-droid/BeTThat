import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';
import { base44 } from '@/api/base44Client';
import { fmtCoin } from '@/lib/demo';

export default function LeaderboardPreview() {
  const [players, setPlayers] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke('getLeaderboard', {})
      .then((res) => setPlayers(res.data.players || []))
      .catch(() => setPlayers([]));
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <SectionHeading
        eyebrow="Season standings"
        title="The players carrying the book"
        description="Ranked by verified wins across settled matches, not win rate alone."
        actionLabel="Full leaderboard"
        actionTo="/leaderboard"
      />

      {players === null ? (
        <div className="mt-10 h-64 animate-pulse rounded-2xl border border-border bg-card" />
      ) : players.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <Trophy className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-4 text-[15px] font-semibold text-foreground">No settled matches yet.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Standings start moving as soon as the first result is verified.
          </p>
        </div>
      ) : (
        <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[48px_1.6fr_1fr_0.8fr_1fr] gap-4 border-b border-border px-5 py-3 text-sm uppercase tracking-[0.16em] text-muted-foreground md:grid">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Matches</span>
            <span className="text-right">W–L</span>
            <span className="text-right">Volume</span>
          </div>
          {players.slice(0, 5).map((p, i) => (
            <div
              key={p.user_id}
              className="grid grid-cols-[36px_1fr_auto] items-center gap-4 border-b border-border/60 px-5 py-4 last:border-0 md:grid-cols-[48px_1.6fr_1fr_0.8fr_1fr]"
            >
              <span className={`nums text-sm font-semibold ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <p className="truncate text-sm font-semibold text-foreground">{p.handle}</p>
              <p className="nums hidden text-right text-sm text-muted-foreground md:block">{p.matches}</p>
              <p className="nums hidden text-right text-sm text-foreground/85 md:block">
                {p.wins}–{p.losses}
              </p>
              <p className="nums text-right text-sm font-semibold text-foreground">
                {fmtCoin(p.volume, p.volume_coin)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}