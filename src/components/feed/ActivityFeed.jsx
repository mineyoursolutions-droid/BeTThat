import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import GraffitiTitle from '@/components/feed/GraffitiTitle';
import FeedItem from '@/components/feed/FeedItem';

export default function ActivityFeed() {
  const [items, setItems] = useState(null);

  const load = useCallback(() => {
    base44.functions
      .invoke('getActivityFeed', {})
      .then((res) => setItems(res.data?.items || []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => base44.entities.Match.subscribe(() => load()), [load]);

  return (
    <section className="rounded-2xl bg-gradient-to-br from-primary/50 via-border to-win/40 p-[1px]">
      <div className="overflow-hidden rounded-2xl bg-card">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-win" />

        <div className="px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <GraffitiTitle text="THE WIRE" />
            <span className="mt-1.5 flex items-center gap-1.5 rounded-full border border-win/30 bg-win/10 px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-win opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-win" />
              </span>
              <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-win">Live</span>
            </span>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Every result, open challenge and spectator wager, as it lands.
          </p>
        </div>

        <div className="border-t border-border/70">
          {items === null ? (
            <div className="divide-y divide-border/60">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="h-8 w-8 animate-pulse rounded-lg bg-secondary" />
                  <span className="flex-1 space-y-1.5">
                    <span className="block h-2.5 w-3/4 animate-pulse rounded bg-secondary" />
                    <span className="block h-2 w-1/2 animate-pulse rounded bg-secondary" />
                  </span>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] font-semibold text-foreground">The wire is quiet.</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Post a challenge or back a side and it shows up here.
              </p>
            </div>
          ) : (
            <div className="max-h-[520px] divide-y divide-border/60 overflow-y-auto no-scrollbar">
              {items.map((item, i) => (
                <FeedItem key={item.id} item={item} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}