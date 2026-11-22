import { Link } from 'react-router-dom';
import { fmtCoin } from '@/lib/demo';
import { gameLook } from '@/lib/matches';

export default function ResultList({ results }) {
  const rows = [...results].reverse().slice(0, 8);
  if (!rows.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-[12px] text-muted-foreground">
        Your settled matches will appear here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const game = gameLook(r.game_slug);
        return (
          <Link
            key={r.id}
            to={`/match/${r.id}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/35"
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold ${
                r.won ? 'bg-win/10 text-win' : 'bg-live/10 text-live'
              }`}
            >
              {r.won ? 'W' : 'L'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-foreground">{r.title}</p>
              <p className="text-[10.5px] text-muted-foreground">
                {game.name} · {new Date(r.date).toLocaleDateString()}
                {r.disputed ? ' · disputed' : ''}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="nums text-[11px] text-muted-foreground">{fmtCoin(r.stake, r.coin)}</p>
              <p className={`nums text-[12px] font-semibold ${r.won ? 'text-win' : 'text-live'}`}>
                {r.won ? '+' : ''}
                {fmtCoin(r.net, r.coin)}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}