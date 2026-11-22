import { PLATFORMS } from '@/lib/console';

export default function PlatformNotes() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PLATFORMS.map((platform) => (
        <div key={platform.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: platform.accent }}
            />
            <h3 className="text-[13px] font-semibold text-foreground">{platform.label}</h3>
          </div>
          <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">{platform.method}</p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{platform.blurb}</p>
        </div>
      ))}
    </div>
  );
}