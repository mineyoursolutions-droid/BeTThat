import { UserRound, Plus } from 'lucide-react';

export default function MatchSide({ player, label, odds }) {
  if (!player) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-muted-foreground">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-dashed border-border">
          <Plus className="h-3.5 w-3.5" />
        </span>
        <span className="truncate text-[12px] font-medium">{label || 'Challenger open'}</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
        <UserRound className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-semibold text-foreground">{player.handle}</span>
        <span className="nums block text-[10px] text-muted-foreground">{player.record}</span>
      </span>
      {odds ? <span className="nums ml-auto text-[11px] font-semibold text-primary">{odds.toFixed(2)}</span> : null}
    </div>
  );
}