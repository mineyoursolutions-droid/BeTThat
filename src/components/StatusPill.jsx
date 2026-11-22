const STYLES = {
  live: { dot: 'bg-live', text: 'text-live', label: 'Live now', ring: 'ring-live/30 bg-live/10' },
  in_play: { dot: 'bg-primary', text: 'text-primary', label: 'In play', ring: 'ring-primary/30 bg-primary/10' },
  matched: { dot: 'bg-primary', text: 'text-primary', label: 'Matched', ring: 'ring-primary/30 bg-primary/10' },
  open: { dot: 'bg-win', text: 'text-win', label: 'Open', ring: 'ring-win/25 bg-win/10' },
  awaiting_result: { dot: 'bg-primary', text: 'text-primary', label: 'Awaiting result', ring: 'ring-primary/30 bg-primary/10' },
  settled: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Settled', ring: 'ring-border bg-secondary' },
  cancelled: { dot: 'bg-muted-foreground', text: 'text-muted-foreground', label: 'Cancelled', ring: 'ring-border bg-secondary' },
};

export default function StatusPill({ status, label }) {
  const style = STYLES[status] || STYLES.open;
  const pulsing = status === 'live' || status === 'in_play' || status === 'awaiting_result';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1 ring-inset ${style.ring} ${style.text}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulsing && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${style.dot}`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${style.dot}`} />
      </span>
      {label || style.label}
    </span>
  );
}