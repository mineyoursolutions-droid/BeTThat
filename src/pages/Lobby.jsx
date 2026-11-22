import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import MatchCard from '@/components/MatchCard';
import MatchFilters from '@/components/lobby/MatchFilters';
import ActivityFeed from '@/components/feed/ActivityFeed';
import { toCardView } from '@/lib/matches';
import { applyLobbyView, countBuckets } from '@/lib/lobby';
import PullToRefresh from '@/components/mobile/PullToRefresh';

export default function Lobby() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [matches, setMatches] = useState(null);
  const [bucket, setBucket] = useState('active');
  const [coin, setCoin] = useState('all');
  const [sort, setSort] = useState('newest');

  const gameFilter = searchParams.get('game') || 'all';
  const setGame = (slug) => setSearchParams(slug === 'all' ? {} : { game: slug });

  const load = useCallback(async () => {
    const page = await base44.entities.Match.list({ sort: '-created_date', limit: 200 });
    setMatches(page.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = applyLobbyView(matches, { gameFilter, bucket, coin, sort });
  const counts = countBuckets(matches, { gameFilter, coin });

  return (
    <PullToRefresh onRefresh={load}>
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">The lobby</p>
          <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[40px]">
            Open stakes
          </h1>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
            Take a challenger seat or back a side as a spectator. Every stake is escrowed until the result is verified.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/find"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-[13px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
          >
            Find a game
          </Link>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition hover:brightness-105"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
            Post a challenge
          </Link>
        </div>
      </div>

      <MatchFilters
        gameFilter={gameFilter}
        onGame={setGame}
        bucket={bucket}
        onBucket={setBucket}
        coin={coin}
        onCoin={setCoin}
        sort={sort}
        onSort={setSort}
        counts={counts}
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0">
          {matches === null ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <p className="text-[15px] font-semibold text-foreground">No matches in this filter yet.</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                Be the first to post a challenge for this title and set the stake yourself.
              </p>
              <Link
                to="/create"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} />
                Post a challenge
              </Link>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:gap-4 md:grid-cols-2">
              {shown.map((match) => (
                <MatchCard key={match.id} match={toCardView(match)} />
              ))}
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-20">
          <ActivityFeed />
        </aside>
      </div>
    </div>
    </PullToRefresh>
  );
}