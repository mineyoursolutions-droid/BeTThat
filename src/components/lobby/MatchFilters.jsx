import { ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import CoinMark from '@/components/CoinMark';
import { COINS, GAMES } from '@/lib/demo';
import { BUCKETS, SORTS } from '@/lib/lobby';

export default function MatchFilters({
  gameFilter,
  onGame,
  bucket,
  onBucket,
  coin,
  onCoin,
  sort,
  onSort,
  counts = {},
}) {
  return (
    <div className="mt-8 space-y-3">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <Chip active={gameFilter === 'all'} onClick={() => onGame('all')}>
          All titles
        </Chip>
        {GAMES.map((g) => (
          <Chip key={g.slug} active={gameFilter === g.slug} onClick={() => onGame(g.slug)}>
            {g.name}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label icon={SlidersHorizontal}>Status</Label>
        {BUCKETS.map((b) => (
          <Chip key={b.id} active={bucket === b.id} onClick={() => onBucket(b.id)}>
            {b.label}
            <span className={`nums ml-1.5 text-sm ${bucket === b.id ? 'text-primary/70' : 'text-muted-foreground/70'}`}>
              {counts[b.id] ?? 0}
            </span>
          </Chip>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
        <Chip active={coin === 'all'} onClick={() => onCoin('all')}>
          Any coin
        </Chip>
        {COINS.map((c) => (
          <button
            key={c.ticker}
            type="button"
            onClick={() => onCoin(c.ticker)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm font-semibold transition ${
              coin === c.ticker
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <CoinMark ticker={c.ticker} size="sm" className="!h-4 !w-4" />
            {c.ticker}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label icon={ArrowUpDown}>Sort</Label>
        {SORTS.map((s) => (
          <Chip key={s.id} active={sort === s.id} onClick={() => onSort(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Label({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm uppercase tracking-[0.14em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}