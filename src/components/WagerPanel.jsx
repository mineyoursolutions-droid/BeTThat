import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Swords, Lock, ArrowRight, Wallet } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import CoinMark from '@/components/CoinMark';
import { fmtCoin } from '@/lib/demo';
import { oddsFor, projectedPayout } from '@/lib/matches';

export default function WagerPanel({ match, wallets, onPlaced }) {
  const { user, navigateToLogin } = useAuth();
  const { toast } = useToast();
  const [side, setSide] = useState('creator');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  // Optimistic UI: show the wager as locked the moment the user taps, and
  // roll it back (with a toast) if the backend rejects it.
  const [pending, setPending] = useState(null);

  const odds = oddsFor(match);
  const isCreator = user && user.id === match.creator_id;
  const closed = match.status === 'settled' || match.status === 'cancelled';
  const balance = (wallets.find((w) => w.coin === match.coin) || {}).available || 0;
  const canSpectate = ['open', 'matched', 'in_play'].includes(match.status);
  const canAccept = match.status === 'open' && !match.challenger_id && user && !isCreator;

  const place = async (payload) => {
    setBusy(true);
    // Optimistic: assume the wager locks, show it immediately.
    const optimistic = {
      kind: payload.kind,
      side: payload.side,
      amount: payload.kind === 'player' ? match.stake : Number(amount) || 0,
      coin: match.coin,
    };
    setPending(optimistic);
    try {
      await base44.functions.invoke('placeWager', { match_id: match.id, ...payload });
      toast({ title: 'Wager locked', description: 'Your stake is now held in escrow.' });
      setAmount('');
      onPlaced();
    } catch (err) {
      // Roll back the optimistic row so the UI never shows a wager that
      // did not happen.
      setPending(null);
      toast({
        title: 'Could not place that wager',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-[15px] font-semibold">Take a side</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Sign in to accept the challenge or back a player from the sideline.
        </p>
        <button
          type="button"
          onClick={() => navigateToLogin()}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground transition hover:brightness-105"
        >
          Sign in to wager
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (closed) {
    const won = match.status === 'settled' && match.winner_id === user.id;
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-[15px] font-semibold">
          {match.status === 'cancelled' ? 'Match cancelled' : won ? 'You took this one' : 'Match settled'}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {match.settle_note || 'The result has been verified and every stake released.'}
        </p>
        <Link
          to="/bets"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-[13px] font-semibold transition hover:border-primary/40 hover:text-primary"
        >
          Review my wagers
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-[15px] font-semibold">Take a side</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Balance available <span className="nums font-semibold text-foreground">{fmtCoin(balance, match.coin)}</span>
        </p>
      </div>

      <div className="space-y-4 p-5">
        {pending ? (
          <div className="rounded-xl border border-primary/40 bg-primary/[0.08] px-4 py-3" aria-live="polite">
            <p className="text-[12px] font-semibold text-primary">
              Locking your {pending.kind === 'player' ? 'challenge stake' : 'wager'}…
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {fmtCoin(pending.amount, pending.coin)} on the {pending.side} side — confirming with the escrow.
            </p>
          </div>
        ) : null}
        {canAccept && (
          <button
            type="button"
            disabled={busy}
            onClick={() => place({ kind: 'player', side: 'challenger' })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[13px] font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
          >
            <Swords className="h-4 w-4" />
            {busy ? 'Locking stake…' : `Accept · ${fmtCoin(match.stake, match.coin)}`}
          </button>
        )}

        {match.status === 'open' && !match.challenger_id && !isCreator && (
          <p className="text-center text-[11.5px] text-muted-foreground">
            Accepting matches the creator's stake exactly.
          </p>
        )}

        {match.status === 'open' && !match.challenger_id && isCreator && (
          <div className="rounded-xl border border-border/80 bg-background/60 px-4 py-3">
            <p className="text-[12px] font-semibold text-foreground">Waiting for a challenger</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
              Your {fmtCoin(match.stake, match.coin)} is escrowed until someone accepts.
            </p>
          </div>
        )}

        {canSpectate && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'creator', label: match.creator_handle || 'Creator' },
                { id: 'challenger', label: match.challenger_handle || 'Challenger' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSide(s.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    side === s.id
                      ? 'border-primary/50 bg-primary/[0.08]'
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {s.id === 'creator' ? 'Creator' : 'Challenger'}
                  </p>
                  <p className="mt-1 truncate text-[12px] font-semibold text-foreground">{s.label}</p>
                  <p className="nums mt-1 text-[13px] font-semibold text-primary">{odds[s.id].toFixed(2)}</p>
                </button>
              ))}
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Amount</label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5">
                <CoinMark ticker={match.coin} size="sm" />
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="nums w-full bg-transparent text-[14px] font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
                />
                <span className="text-[11px] font-semibold text-muted-foreground">{match.coin}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-background/60 px-3 py-2.5">
              <span className="text-[11.5px] text-muted-foreground">Projected return</span>
              <span className="nums text-[12.5px] font-semibold text-win">
                {fmtCoin(projectedPayout(match, side, amount), match.coin)}
              </span>
            </div>

            <button
              type="button"
              disabled={busy || !(Number(amount) > 0)}
              onClick={() => place({ kind: 'spectator', side, amount: Number(amount), coin: match.coin })}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/[0.08] px-4 py-3 text-[13px] font-semibold text-primary transition hover:bg-primary/[0.14] disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {busy ? 'Locking wager…' : 'Back this side'}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Spectator pool settles in {match.coin} · 5% operator fee on the pool
            </p>
          </div>
        )}

        {!canSpectate && !canAccept && (
          <div className="rounded-xl border border-border/80 bg-background/60 px-4 py-3">
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" />
              Wagering is closed on this match.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}