import { ArrowUpRight } from 'lucide-react';
import { CONNECT_LABEL, billiardsBook } from '@/lib/console';

const PLATFORM_SHORT = {
  Wii: 'wii',
  Switch: 'switch',
  PS5: 'ps5',
  Xbox: 'xbox',
  PC: 'pc',
  Mobile: 'mobile',
};

export default function BilliardsBook({ onPick }) {
  const book = billiardsBook();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {book.map((entry) => {
        const platforms = entry.game.platforms || [];
        const firstPlatform = PLATFORM_SHORT[platforms[0]] || 'pc';

        return (
          <div key={entry.slug} className="flex flex-col rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-sm tracking-[0.12em] text-muted-foreground">
                {entry.game.monogram}
              </span>
              <span className="text-sm font-bold uppercase tracking-[0.12em] text-primary">
                {CONNECT_LABEL[entry.connect]}
              </span>
            </div>

            <h3 className="mt-2 text-[14px] font-semibold leading-tight text-foreground">{entry.game.name}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{entry.game.subtitle}</p>

            <div className="mt-2 flex flex-wrap gap-1">
              {platforms.map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-border px-1.5 py-0.5 text-sm font-semibold text-muted-foreground"
                >
                  {p}
                </span>
              ))}
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{entry.how}</p>

            <button
              type="button"
              onClick={() => onPick({ platform: firstPlatform, slug: entry.slug })}
              className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-primary transition hover:brightness-110"
            >
              Open a room
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}