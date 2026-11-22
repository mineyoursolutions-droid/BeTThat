import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import CountUp from '@/components/motion/CountUp';
import { fmtCoin, fmtUsd, toUsd } from '@/lib/demo';

// Live tracking strip — always on. Polls getActivityFeed every 20s
// (paused while the tab is hidden, resumed on return) and shows the
// running totals: games played, total wagered, live matches right now,
// open challenges — plus the freshest live pots. Read-only display;
// it never changes settlement or wagering logic.
const POLL_MS = 20000;

export default function LiveStrip() {
  const [feed, setFeed] = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(() => {
    base44.functions
      .invoke('getActivityFeed', {})
      .then((res) => setFeed(res.data || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const tick = () => {
      if (!document.hidden) load();
    };
    timerRef.current = window.setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  const totals = feed?.totals || null;
  const items = feed?.items || [];
  const wageredUsd = totals
    ? Object.entries(totals.wageredByCoin || {}).reduce(
        (sum, [coin, amount]) => sum + toUsd(amount, coin),
        0,
      )
    : 0;
  const liveItems = items.filter((i) => i.kind === 'live' || i.kind === 'challenge').slice(0, 3);

  return (
    <section
      aria-live="off"
      className="glass-concrete rounded-2xl border border-border px-5 py-4"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="flex items-center gap-2 rounded-full border border-win/30 bg-win/10 px-3 py-1">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-win opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-win" />
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.14em] text-win">Live</span>
        </span>

        <Stat label="Games played" value={totals ? totals.gamesPlayed : null} />
        <Stat label="Total wagered" value={totals ? Math.round(wageredUsd) : null} prefix="$" />
        <Stat label="Live now" value={totals ? totals.liveNow : null} />
        <Stat label="Open challenges" value={totals ? totals.openChallenges : null} />

        {liveItems.length > 0 ? (
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
            {liveItems.map((item) => (
              <Link
                key={item.id}
                to={item.match_id ? `/match/${item.match_id}` : '/lobby'}
                className="nums inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <span className="max-w-[140px] truncate">{item.title || item.game}</span>
                <span className="text-primary">{fmtCoin(item.amount, item.coin)}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {totals
          ? `Tracking every match on the corner — refreshes automatically${wageredUsd > 0 ? ` · ${fmtUsd(wageredUsd)} wagered all-time` : ''}.`
          : 'Loading live totals…'}
      </p>
    </section>
  );
}

function Stat({ label, value, prefix = '' }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-sm uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className="nums neon-number text-[17px] font-bold">
        {value === null ? '—' : <CountUp value={value} prefix={prefix} />}
      </span>
    </span>
  );
}
