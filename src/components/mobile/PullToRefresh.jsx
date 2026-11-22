// Lightweight pull-to-refresh for mobile lists.
//
// Wraps a page section; on touch devices, pulling down while already at the
// top of the page past a threshold triggers onRefresh. Desktop / mouse users
// are unaffected (the gesture only fires from touch events), and normal
// scrolling is never hijacked: the pull only engages when window.scrollY is 0
// and the gesture is a downward drag.
import { useRef, useState } from 'react';
import { ArrowDown, Loader2, RefreshCw } from 'lucide-react';

const THRESHOLD = 80;

export default function PullToRefresh({ onRefresh, children, label = 'Pull to refresh' }) {
  const startY = useRef(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = (e) => {
    if (refreshing) return;
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (startY.current === null || refreshing) return;
    if (window.scrollY > 0) {
      startY.current = null;
      setPull(0);
      return;
    }
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPull(Math.min(delta, THRESHOLD * 1.5));
  };

  const handleTouchEnd = async () => {
    if (startY.current === null) return;
    const pulled = pull;
    startY.current = null;
    setPull(0);
    if (pulled >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  };

  const refresh = async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label={label}
    >
      <div
        aria-hidden={!refreshing && pull === 0}
        className="flex justify-center overflow-hidden transition-all duration-150"
        style={{ height: refreshing ? 44 : pull > 0 ? Math.min(pull * 0.5, 40) : 0 }}
      >
        <span className="flex items-center gap-2 pt-2 text-[12px] font-semibold text-muted-foreground">
          {refreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Refreshing…
            </>
          ) : (
            <>
              <ArrowDown className="h-4 w-4" /> {pull >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
            </>
          )}
        </span>
      </div>
      {/* Manual refresh for desktop / accessibility — same loader, no gesture needed. */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh"
          className="mb-1 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[11.5px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {children}
    </div>
  );
}
