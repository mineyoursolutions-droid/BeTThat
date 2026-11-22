import { Loader2, Gamepad2, Swords } from 'lucide-react';
import { gameBySlug, fmtCoin } from '@/lib/demo';
import ReputationBadge, { RecordLine } from '@/components/ReputationBadge';

const idFor = (player) => {
  if (player.platform === 'Xbox') return player.xbox_gamertag;
  if (player.platform === 'PlayStation') return player.psn_id;
  if (player.platform === 'PC') return player.steam_id;
  return player.xbox_gamertag || player.psn_id || player.steam_id;
};

export default function LookingPlayers({ players, onChallenge, busyId }) {
  if (players === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (!players.length) {
    return (
      <p className="rounded-xl border border-dashed border-border px-5 py-12 text-center text-[12.5px] text-muted-foreground">
        Nobody is listed right now. Double-check your opponent's console ID and send them a direct challenge link instead.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {players.map((p) => {
        const game = gameBySlug(p.game_slug);
        const consoleId = idFor(p);
        const ready = Number(p.stake) > 0;
        return (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-[13px] font-semibold text-foreground">{p.handle}</p>
                  <ReputationBadge profile={p} />
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  <Gamepad2 className="h-3 w-3" />
                  {p.platform} · {game?.name || p.game_slug}
                </p>
                <RecordLine profile={p} className="mt-0.5" />
              </div>
              <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {p.coin}
              </span>
            </div>

            <p className="nums mt-2.5 text-[13px] font-semibold text-primary">
              {ready ? fmtCoin(p.stake, p.coin) : 'Stake not set'}
            </p>
            {consoleId ? <p className="mt-0.5 text-[10.5px] text-muted-foreground">ID: {consoleId}</p> : null}
            {p.looking_note ? (
              <p className="mt-1.5 line-clamp-2 text-[10.5px] leading-relaxed text-muted-foreground">{p.looking_note}</p>
            ) : null}

            <button
              type="button"
              disabled={!ready || busyId === p.id}
              onClick={() => onChallenge(p)}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-[11.5px] font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
            >
              {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Swords className="h-3 w-3" />}
              {ready ? 'Post matching challenge' : 'Waiting on stake'}
            </button>
          </div>
        );
      })}
    </div>
  );
}