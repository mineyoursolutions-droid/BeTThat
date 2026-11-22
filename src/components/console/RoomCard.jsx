import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Lock, Loader2, MapPin, X, UserCheck } from 'lucide-react';
import { platformById, roomStatusLabel } from '@/lib/console';
import { gameLook } from '@/lib/matches';

export default function RoomCard({ room, user, busy, onJoin, onClose }) {
  const [copied, setCopied] = useState(false);
  const platform = platformById(room.platform);
  const game = gameLook(room.game_slug);
  const isHost = Boolean(user && room.host_id === user.id);
  const isGuest = Boolean(user && room.guest_id === user.id);
  const seated = isHost || isGuest;
  const open = room.status === 'open' && !room.guest_id;

  const copy = async () => {
    await navigator.clipboard.writeText(room.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="no-select overflow-hidden rounded-2xl border border-border bg-card">
      <div className={`h-[3px] w-full bg-gradient-to-r ${game.gradient}`} />
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-sm font-bold tracking-[0.12em]"
              style={{ backgroundColor: `${platform.accent}1f`, color: platform.accent }}
            >
              {platform.short.toUpperCase()}
            </span>
            <span className="truncate text-sm uppercase tracking-[0.16em] text-muted-foreground">
              {room.game_name}
            </span>
          </div>
          <span className={`text-sm font-bold uppercase tracking-[0.12em] ${open ? 'text-win' : 'text-muted-foreground'}`}>
            {roomStatusLabel(room.status)}
          </span>
        </div>

        <h3 className="mt-2.5 text-[16px] font-semibold leading-tight text-foreground">
          {room.title || room.game_name}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            {room.region || 'Global'}
          </span>
          {room.starts_at ? <span className="nums">Breaks {new Date(room.starts_at).toLocaleString()}</span> : null}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-foreground">{room.host_handle}</span>
          <span className="text-sm uppercase tracking-[0.14em] text-muted-foreground">vs</span>
          <span className={room.guest_handle ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
            {room.guest_handle || 'Seat open'}
          </span>
          {room.guest_handle ? <UserCheck className="h-3.5 w-3.5 text-win" /> : null}
        </div>

        {room.note ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{room.note}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 font-mono text-sm font-semibold text-foreground transition hover:border-primary/40"
          >
            {copied ? <Check className="h-3 w-3 text-win" /> : <Copy className="h-3 w-3" />}
            {room.room_code}
          </button>

          {seated ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 font-mono text-sm text-muted-foreground">
              <Lock className="h-3 w-3" />
              {room.lobby_code || 'no in-game code'}
            </span>
          ) : room.lobby_code ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground">
              <Lock className="h-3 w-3" />
              in-game code hidden
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          {open && user && !isHost ? (
            <button
              type="button"
              onClick={() => onJoin(room)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {busy ? 'Taking the seat…' : 'Take the seat'}
            </button>
          ) : null}

          {open && !user ? (
            <Link
              to="/login"
              className="inline-flex items-center rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
            >
              Sign in to join
            </Link>
          ) : null}

          {seated && open ? (
            <span className="text-sm font-semibold text-primary">Waiting on an opponent</span>
          ) : null}
          {seated && !open ? (
            <span className="text-sm font-semibold text-win">Both cues at the table</span>
          ) : null}

          {isHost && room.status !== 'closed' ? (
            <button
              type="button"
              onClick={() => onClose(room)}
              aria-label="Close room"
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-sm font-semibold text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
            >
              <X className="h-3 w-3" />
              Close
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}