import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Crown, Pause, Play, Timer, Trophy, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useGuest, guestPayload, pokerIdentityId } from '@/lib/guest';
import GuestTablePanel from '@/components/poker/GuestTablePanel';
import InviteCard from '@/components/poker/InviteCard';
import { useToast } from '@/components/ui/use-toast';
import CoinMark from '@/components/CoinMark';
import PokerCard from '@/components/PokerCard';
import { fmtCoin } from '@/lib/demo';

// Lowball table — Chain Gang Poker. Ace-to-five lowball: 5 cards
// each, one draw (throw back up to five), a bet after the draw, then
// showdown. The lowest hand wins the whole pot; tied players split
// it. A-2-3-4-5, the wheel, is the best hand. Live state polls every
// 10s while the hand is in play, and the 60-second turn clock sweeps
// a stalled player server-side.
const DRAW_LIMIT = 5;

export default function LowballTable() {
  const { id } = useParams();
  const { user } = useAuth();
  const { guest, saveName } = useGuest();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [state, setState] = useState(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [discards, setDiscards] = useState([]);
  const expiredRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('getLowballState', { table_id: id, ...(user ? {} : guestPayload(guest)) });
      setState(res.data);
    } catch (err) {
      setMissing(true);
    }
  }, [id, user, guest]);

  useEffect(() => {
    load();
  }, [load]);

  // Live poll while the hand is in play or the table is waiting in
  // the lobby (bots seat and auto-deal there, so the lobby has to stay
  // live too). Paused while the tab hides.
  useEffect(() => {
    if (!state?.table || (state.table.status !== 'in_play' && state.table.status !== 'lobby')) return;
    const tick = () => {
      if (!document.hidden) load();
    };
    const timer = window.setInterval(tick, 10000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [state?.table?.status, load]);

  // 1s turn countdown. When it hits zero the next state poll sweeps
  // the expired turn server-side, so refresh right away.
  const expiresAt = state?.table?.turn_expires_at;
  useEffect(() => {
    if (!state?.table || state.table.status !== 'in_play' || !expiresAt) {
      setSecondsLeft(null);
      expiredRef.current = false;
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        load();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, state?.table?.status, load]);

  const invoke = async (fn, payload, okTitle, okDescription) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke(fn, payload);
      if (okTitle) toast({ title: okTitle, description: okDescription });
      await load();
      return res;
    } catch (err) {
      toast({
        title: 'That did not go through',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
      await load();
      return null;
    } finally {
      setBusy(false);
    }
  };

  const act = (action, discardsToSend = []) =>
    invoke('lowballAct', { table_id: id, action, discards: discardsToSend });

  // Joining from a private-table invite link (?code=XXXXXX) seats the
  // guest automatically once the table has loaded.
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code || autoJoinedRef.current) return;
    const t = state?.table;
    if (!t || t.status !== 'lobby' || state?.is_player || !t.is_play_money) return;
    autoJoinedRef.current = true;
    invoke('joinLowballTable', { table_id: id, ...(user ? {} : guestPayload(guest)) }, 'Seat taken', 'You joined with the invite code — play chips only.');
  }, [state, searchParams, id, user, guest, invoke]);

  // Clear the discard picker whenever the turn moves on.
  useEffect(() => {
    setDiscards([]);
  }, [state?.table?.turn_user_id, state?.table?.reveal_round]);

  if (missing) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="text-[26px] font-extrabold">This table is no longer listed</h1>
        <p className="mt-3 text-[14px] text-muted-foreground">It may have been cancelled or removed.</p>
        <Link to="/poker/lowball" className="mt-6 inline-block rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Back to Lowball
        </Link>
      </div>
    );
  }

  if (!state?.table) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }

  const { table, players, my_hand, my_best, my_seat, is_player } = state;
  const coin = table.coin;
  const playMoney = coin === 'PLAY';
  const myPlayer = my_seat >= 0 ? players[my_seat] : null;
  const myTurn =
    is_player && table.status === 'in_play' && table.turn_user_id === pokerIdentityId(user, guest) && myPlayer && !myPlayer.folded;
  const callAmount = Math.max(0, Number(table.current_bet || 0) - Number(myPlayer?.round_paid || 0));
  const canCheck = myPlayer && Number(myPlayer.round_paid || 0) >= Number(table.current_bet || 0);
  const clock = secondsLeft === null ? '0:60' : `0:${String(secondsLeft).padStart(2, '0')}`;
  const result = table.result_json ? JSON.parse(table.result_json) : null;
  const turnPlayer = players.find((p) => p.user_id === table.turn_user_id);
  // Draw pass while any active player still has to draw;
  // once everyone has drawn, the betting pass opens.
  const drawPassActive = players.some((p) => !p.folded && !p.drawn);
  const myDrawTurn = myTurn && drawPassActive;
  const canDraw = myDrawTurn && discards.length <= DRAW_LIMIT;
  const phaseLabel =
    table.phase === 'showdown'
      ? 'Showdown'
      : drawPassActive
        ? 'Draw'
        : 'Betting';

  const seatBadge = (p) => {
    if (p.folded) return { label: 'Folded', cls: 'border-border text-muted-foreground' };
    return null;
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <Link
        to="/poker/lowball"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Lowball lobby
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-graffiti text-3xl leading-none text-foreground sm:text-4xl">{table.title}</h1>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
            table.status === 'lobby'
              ? 'border-primary/30 bg-primary/10 text-primary'
              : table.status === 'in_play'
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                : 'border-border text-muted-foreground'
          }`}
        >
          {table.status === 'lobby' ? 'Waiting for players' : table.status === 'in_play' ? 'In play' : table.status}
        </span>
        {playMoney && (
          <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-cyan-300">
            Play money
          </span>
        )}
        {table.status === 'in_play' && (
          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {phaseLabel}
          </span>
        )}
        <span className="nums ml-auto flex items-center gap-2 text-[17px] font-bold text-foreground">
          <CoinMark ticker={coin} size="sm" />
          Pot {fmtCoin(table.pot || 0, coin)}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Buy-in <span className="nums font-semibold text-foreground">{fmtCoin(table.stake, coin)}</span> · Bet per
        round <span className="nums font-semibold text-foreground">{fmtCoin(table.bet_unit, coin)}</span> · 5 players
        max · {playMoney ? 'play money — no fee' : '5% house fee at showdown'} · One draw: throw back up to five
      </p>

      {table.status === 'lobby' && table.is_private && table.join_code && (
        <InviteCard gameSlug="lowball" tableId={id} joinCode={table.join_code} className="mt-4" />
      )}
      {/* Turn banner */}
      {table.status === 'in_play' && turnPlayer && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-bold uppercase tracking-[0.14em] text-primary">
            <Pause className="h-3.5 w-3.5" />
            {phaseLabel}
          </span>
          <span className="text-sm text-muted-foreground">
            {myTurn ? 'Your move' : `${turnPlayer.handle || 'A player'} to act`}
          </span>
          <span className="nums ml-auto flex items-center gap-1.5 text-[17px] font-bold text-foreground">
            <Timer className="h-4 w-4 text-primary" />
            {clock}
          </span>
        </div>
      )}

      {/* Seats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {players.map((p) => {
          const isTurn = table.status === 'in_play' && table.turn_user_id === p.user_id;
          const badge = seatBadge(p);
          const isMe = p.user_id === pokerIdentityId(user, guest);
          return (
            <div
              key={p.user_id}
              className={`overflow-hidden rounded-2xl border bg-card p-4 transition ${
                isTurn ? 'border-primary/60 ring-2 ring-primary/30' : 'border-border'
              } ${p.folded ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                  {p.handle}
                  {isMe ? ' (you)' : ''}
                </p>
                {p.is_bot && (
                  <span className="shrink-0 rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-300">
                    Bot
                  </span>
                )}
                {p.seat === Number(table.dealer_seat || 0) && (
                  <span title="Dealer">
                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                  </span>
                )}
              </div>
              <p className="nums mt-1 text-xs text-muted-foreground">
                Stack {fmtCoin(p.stack, coin)} · In pot {fmtCoin(p.contributed, coin)}
              </p>
              <div className="mt-3 flex w-fit gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => {
                  const card = isMe && my_hand ? my_hand[i] : null;
                  return card ? (
                    <PokerCard key={`${card}-${i}`} card={card} size="sm" dimmed={p.folded} />
                  ) : (
                    <PokerCard key={`back-${i}`} faceDown size="sm" dimmed={p.folded} />
                  );
                })}
              </div>
              <div className="mt-3 flex min-h-6 items-center gap-2">
                {badge && (
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
                {isTurn && (
                  <span className="nums text-xs font-bold text-primary">To act · {clock}</span>
                )}
              </div>
            </div>
          );
        })}
        {players.length < 5 && table.status === 'lobby' && (
          <div className="flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Empty seat — {5 - players.length} left
          </div>
        )}
      </div>

      {!user && table.status === 'lobby' && (
        <div className="mt-6">
          <GuestTablePanel gameSlug="lowball" gameName="Lowball" guest={guest} onNameSaved={saveName} compact />
        </div>
      )}
      {/* Lobby controls */}
      {table.status === 'lobby' && (
        <div className="mt-6 flex flex-wrap gap-2">
          {!is_player && players.length < 5 && (playMoney || user) && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                invoke('joinLowballTable', { table_id: id, ...(user ? {} : guestPayload(guest)) }, 'Seat taken', playMoney ? 'Seat taken — play chips only.' : 'Your buy-in is locked in escrow.')
              }
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {busy ? 'Joining…' : `Take a seat · ${fmtCoin(table.stake, coin)} buy-in`}
            </button>
          )}
          {!is_player && !playMoney && !user && table.status === 'lobby' && (
            <p className="w-full text-sm text-muted-foreground">
              This table is real money —{' '}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                sign in
              </Link>{' '}
              to take a seat, or play a play-money table as a guest.
            </p>
          )}
          {is_player && table.creator_id === pokerIdentityId(user, guest) && (
            <>
              <button
                type="button"
                disabled={busy || (playMoney ? players.length < 1 : players.length < 2)}
                onClick={() =>
                  invoke('startLowballTable', { table_id: id }, 'Cards dealt', 'Your 4 cards are dealt — draw 1 is open.')
                }
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {busy ? 'Dealing…' : 'Deal the hand'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  invoke('cancelLowballTable', { table_id: id }, 'Table cancelled', playMoney ? 'Table cancelled — no real money moved.' : 'Every buy-in was refunded.')
                }
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel table
              </button>
            </>
          )}
          {players.length < 2 && (
            <p className="w-full text-sm text-muted-foreground">
              {playMoney
                ? 'Bots will fill the empty seats — deal whenever you are ready, or wait for friends to join.'
                : 'Waiting on at least 2 players to deal.'}
            </p>
          )}
        </div>
      )}

      {/* My hand */}
      {is_player && my_hand && table.status === 'in_play' && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card p-6">
          <h2 className="text-[15px] font-semibold">Your hand — lowest hand wins</h2>
          <div className="mt-4 flex w-fit gap-2">
            {my_hand.map((card, i) => {
              const selected = discards.includes(i);
              const cardEl = <PokerCard key={`${card}-${i}`} card={card} size="lg" />;
              return myDrawTurn ? (
                <button
                  key={`${card}-${i}`}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setDiscards((prev) =>
                      prev.includes(i)
                        ? prev.filter((x) => x !== i)
                        : prev.length >= DRAW_LIMIT
                          ? prev
                          : [...prev, i],
                    )
                  }
                  className={`rounded-lg transition ${selected ? '-translate-y-2 ring-4 ring-primary' : 'hover:-translate-y-1'}`}
                  aria-pressed={selected}
                  title={selected ? 'Throw this card back' : 'Tap to throw this card back'}
                >
                  {cardEl}
                </button>
              ) : (
                cardEl
              );
            })}
          </div>
          {my_best && (
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Your low: <span className="font-semibold text-foreground">{my_best.low?.name}</span>{' '}
                <span className="text-primary">· lowest hand wins</span>
              </span>
            </div>
          )}
          {myDrawTurn && (
            <p className="mt-3 text-sm text-muted-foreground">
              Tap the cards to throw back (up to five), then draw.
            </p>
          )}
        </div>
      )}

      {/* Draw action bar */}
      {myDrawTurn && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-primary/40 bg-card p-6">
          <h2 className="text-[15px] font-semibold">Your draw</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {discards.length > 0
              ? `Throwing back ${discards.length} card${discards.length > 1 ? 's' : ''} — you will get that many new ones.`
              : 'Pick up to five cards, or draw with none to stand pat.'}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy || !canDraw}
              onClick={() => act('draw', discards)}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-40"
            >
              Draw {discards.length > 0 ? `· ${discards.length} new card${discards.length > 1 ? 's' : ''}` : '· stand pat'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act('fold')}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-rose-500/50 hover:text-rose-400 disabled:opacity-40"
            >
              Fold
            </button>
          </div>
        </div>
      )}

      {/* Betting action bar */}
      {myTurn && !drawPassActive && table.phase === 'betting' && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-primary/40 bg-card p-6">
          <h2 className="text-[15px] font-semibold">Your move</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bet to call: <span className="nums font-semibold text-foreground">{fmtCoin(callAmount, coin)}</span> ·
            Your stack: <span className="nums font-semibold text-foreground">{fmtCoin(myPlayer.stack, coin)}</span>
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              disabled={busy || !canCheck}
              onClick={() => act('check')}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
            >
              Check
            </button>
            <button
              type="button"
              disabled={busy || Number(table.current_bet || 0) > 0}
              onClick={() => act('bet')}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-40"
            >
              Bet {fmtCoin(table.bet_unit, coin)}
            </button>
            <button
              type="button"
              disabled={busy || callAmount <= 0}
              onClick={() => act('call')}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-40"
            >
              Call {fmtCoin(callAmount, coin)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => act('fold')}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-rose-500/50 hover:text-rose-400 disabled:opacity-40"
            >
              Fold
            </button>
          </div>
        </div>
      )}

      {/* Showdown */}
      {table.status === 'settled' && result && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Trophy className="h-4 w-4 text-primary" />
            Showdown — {table.settle_note || 'Hand settled'}
          </h2>
          <p className="nums mt-2 text-sm text-muted-foreground">
            Pot {fmtCoin(result.pot, coin)} · House fee {fmtCoin(result.fee, coin)} · Paid out{' '}
            {fmtCoin(result.distributable, coin)}
          </p>
          <ul className="mt-4 space-y-3">
            {players.map((p) => {
              const hand = result.hands?.[p.user_id];
              const r = p.result || {};
              return (
                <li key={p.user_id} className="rounded-xl border border-border/80 bg-background/60 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{p.handle}</span>
                    {p.is_bot && (
                      <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-300">
                        Bot
                      </span>
                    )}
                    <span className="nums ml-auto text-sm font-semibold text-foreground">
                      {r.winnings > 0 ? `+${fmtCoin(r.winnings, coin)} winnings` : 'No winnings'}
                      {` · ${fmtCoin(r.credit || 0, coin)} back`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Low: <span className="font-semibold text-foreground">{hand?.best_low?.name || '—'}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
