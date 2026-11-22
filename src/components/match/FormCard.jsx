import ReputationBadge, { RecordLine } from '@/components/ReputationBadge';
import FormBars from '@/components/match/FormBars';

export default function FormCard({ label, handle, form, empty }) {
  if (empty) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background/40 p-4">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-[13px] font-semibold text-muted-foreground">Seat open</p>
      </div>
    );
  }

  if (form === undefined) {
    return <div className="h-[150px] animate-pulse rounded-xl border border-border bg-background/60" />;
  }

  if (!form) {
    return (
      <div className="rounded-xl border border-border bg-background/60 p-4">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-1.5 truncate text-[13px] font-semibold text-foreground">{handle}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">Form unavailable right now.</p>
      </div>
    );
  }

  const totals = form.totals;
  const pips = form.results.slice(-10);

  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <ReputationBadge profile={form.reputation} />
      </div>
      <p className="mt-1.5 truncate text-[13px] font-semibold text-foreground">{handle}</p>

      {totals.matches ? (
        <>
          <div className="mt-1 flex items-center justify-between gap-2">
            <RecordLine profile={form.reputation} />
            <span className="nums text-[10.5px] text-muted-foreground">
              {Math.round(totals.winRate * 100)}% win
            </span>
          </div>
          <div className="mt-2">
            <FormBars results={form.results} />
          </div>
          <div className="mt-1 flex gap-1">
            {pips.map((r, i) => (
              <span
                key={`${r.id}-${i}`}
                title={`${r.won ? 'Win' : 'Loss'} · ${r.title}`}
                className={`h-1.5 flex-1 rounded-full ${r.won ? 'bg-win' : 'bg-live/60'}`}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          No settled matches yet — unproven form.
        </p>
      )}
    </div>
  );
}