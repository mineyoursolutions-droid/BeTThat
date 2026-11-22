import { useEffect, useRef, useState } from 'react';
import { Check, Pause, Timer, TrendingUp, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import CoinMark from '@/components/CoinMark';
import { fmtCoin, round } from '@/lib/demo';

// Mid-match timeout raise — poker-style. While a match is live, either
// player can pause both screens and propose a higher stake: 2x, 3x, 5x,
// All-In, or a custom amount. The opponent gets 60 seconds to accept or
// decline. Money only moves when both agree and both can cover the
// top-up; otherwise the match resumes at the original stake.
const RAISE_MULTIPLIERS = [2, 3, 5];

export default function RaiseStakes({ match, wallets, user, onChanged }) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const expiredRef = useRef(false);

  const stake = Number(match.stake || 0);
  const coin = match.coin;
  const balance = (wallets.find((w) => w.coin === coin) || {}).available || 0;
  const isPlayer = user && (user.id === match.creator_id || user.id === match.challenger_id);
  const isProposer = user && match.raise_proposer_id === user.id;
  const pending = match.raise_status === 'pending';
  const canRaise = isPlayer && match.status === 'in_play' && !pending;
  const proposerHandle =
    match.raise_proposer_side === 'creator' ? match.creator_handle : match.challenger_handle;

  // Live 1s countdown off the server-set deadline. When it hits zero, ask
  // the backend to expire the proposal (it re-checks server-side) and
  // reload the match so both screens resume.
  useEffect(() => {
    if (!pending || !match.raise_expires_at) {
      setSecondsLeft(null);
      expiredRef.current = false;
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(match.raise_expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        base44.functions
          .invoke('expireRaise', { match_id: match.id })
          .catch(() => {})
          .finally(() => onChanged && onChanged());
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [pending, match.raise_expires_at, match.id, onChanged]);

  const invoke = async (fn, payload, okTitle, okDescription) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke(fn, payload);
      toast({ title: okTitle, description: okDescription });
      setPickerOpen(false);
      setSelected(null);
      setCustom('');
      if (onChanged) onChanged();
      return res;
    } catch (err) {
      toast({
        title: 'Raise did not go through',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
      if (onChanged) onChanged();
      return null;
    } finally {
      setBusy(false);
    }
  };

  const propose = () => {
    const newStake = selected === 'custom' ? round(Number(custom) || 0, coin) : round(Number(selected) || 0, coin);
    if (!(newStake > stake)) {
      toast({
        title: 'Pick a higher stake',
        description: 'The new stake has to be above the current one.',
        variant: 'destructive',
      });
      return;
    }
    if (round(newStake - stake, coin) > round(Number(balance) || 0, coin)) {
      toast({
        title: 'Not enough balance',
        description: `You need ${fmtCoin(round(newStake - stake, coin), coin)} available to cover the raise.`,
        variant: 'destructive',
      });
      return;
    }
    invoke(
      'proposeRaise',
      { match_id: match.id, new_stake: newStake },
      'Timeout called — raise proposed',
      `Your opponent has 60 seconds to accept ${fmtCoin(newStake, coin)} per player.`,
    );
  };

  const respond = (action) =>
    invoke(
      'respondRaise',
      { match_id: match.id, action },
      action === 'accept' ? 'Raise accepted' : 'Raise declined',
      action === 'accept'
        ? `The stakes are now ${fmtCoin(match.raise_new_stake, coin)} per player. Match resumes.`
        : 'The match resumes at the original stake.',
    );

  // Spectators only ever see the timeout notice — no buttons.
  if (!isPlayer && !pending) return null;

  const presetOptions = RAISE_MULTIPLIERS.map((m) => ({
    id: `${m}x`,
    label: `${m}x`,
    value: round(stake * m, coin),
    disabled: false,
  }));
  const allInValue = round(Number(balance) || 0, coin);
  const options = [
    ...presetOptions,
    { id: 'all-in', label: 'All-In', value: allInValue, disabled: !(allInValue > stake) },
  ];

  const chosenValue = selected === 'custom' ? round(Number(custom) || 0, coin) : round(Number(selected) || 0, coin);
  const chosenTopUp = round(chosenValue - stake, coin);
  const canPropose = chosenValue > stake && chosenTopUp <= round(Number(balance) || 0, coin);

  const clock = secondsLeft === null ? '0:60' : `0:${String(secondsLeft).padStart(2, '0')}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {pending ? (
        <div className="p-6">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-bold uppercase tracking-[0.14em] text-primary">
              <Pause className="h-3.5 w-3.5" />
              Timeout
            </span>
            <span className="nums ml-auto flex items-center gap-1.5 text-[17px] font-bold text-foreground">
              <Timer className="h-4 w-4 text-primary" />
              {clock}
            </span>
          </div>

          {isPlayer && !isProposer ? (
            <>
              <h3 className="mt-4 text-[17px] font-extrabold leading-tight">
                {proposerHandle || 'Your opponent'} wants to raise the stakes
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                New stake <span className="nums font-semibold text-foreground">{fmtCoin(match.raise_new_stake, coin)}</span>{' '}
                per player — pot becomes{' '}
                <span className="nums font-semibold text-foreground">
                  {fmtCoin(Number(match.raise_new_stake || 0) * 2, coin)}
                </span>
                . Your top-up is{' '}
                <span className="nums font-semibold text-foreground">
                  {fmtCoin(round(Number(match.raise_new_stake || 0) - stake, coin), coin)}
                </span>
                . Accept and it comes out of your balance into escrow; decline and the match resumes as-is.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond('accept')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {busy ? 'Locking…' : 'Accept raise'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond('decline')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Decline
                </button>
              </div>
            </>
          ) : isPlayer && isProposer ? (
            <>
              <h3 className="mt-4 text-[17px] font-extrabold leading-tight">Raise proposed — waiting on your opponent</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                You proposed{' '}
                <span className="nums font-semibold text-foreground">{fmtCoin(match.raise_new_stake, coin)}</span> per
                player. If they accept,{' '}
                <span className="nums font-semibold text-foreground">
                  {fmtCoin(round(Number(match.raise_new_stake || 0) - stake, coin), coin)}
                </span>{' '}
                comes out of your balance into escrow. If they decline or the clock runs out, the match resumes at the
                original stake.
              </p>
            </>
          ) : (
            <>
              <h3 className="mt-4 text-[17px] font-extrabold leading-tight">Timeout — the players are deciding</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {proposerHandle || 'One player'} proposed raising the stake to{' '}
                <span className="nums font-semibold text-foreground">{fmtCoin(match.raise_new_stake, coin)}</span> per
                player. The match is paused while the other player answers.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Raise the stakes
            </h3>
            <span className="nums text-sm text-muted-foreground">
              Now <span className="font-semibold text-foreground">{fmtCoin(stake, coin)}</span> per player
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Call a timeout and put a bigger number on the table. Both screens pause for 60 seconds while your opponent
            decides — nothing moves unless they accept and both of you can cover it.
          </p>

          {!pickerOpen ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/[0.08] px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/[0.14]"
            >
              <TrendingUp className="h-4 w-4" />
              Propose a raise
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => {
                      setSelected(opt.value);
                      setCustom('');
                    }}
                    className={`rounded-xl border p-3 text-center transition disabled:opacity-40 ${
                      selected === opt.value
                        ? 'border-primary/50 bg-primary/[0.08]'
                        : 'border-border hover:border-border/80'
                    }`}
                  >
                    <p className="text-sm font-bold text-foreground">{opt.label}</p>
                    <p className="nums mt-0.5 truncate text-sm font-semibold text-primary">
                      {fmtCoin(opt.value, coin)}
                    </p>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-sm uppercase tracking-[0.14em] text-muted-foreground">
                  Or a custom stake per player
                </label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5">
                  <CoinMark ticker={coin} size="sm" />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={custom}
                    onChange={(e) => {
                      setCustom(e.target.value);
                      setSelected('custom');
                    }}
                    placeholder="0.00"
                    className="nums w-full bg-transparent text-[14px] font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                  <span className="text-sm font-semibold text-muted-foreground">{coin}</span>
                </div>
              </div>

              {selected !== null && chosenValue > 0 ? (
                <div className="flex items-center justify-between rounded-xl border border-border/80 bg-background/60 px-3 py-2.5">
                  <span className="text-sm text-muted-foreground">Your top-up into escrow</span>
                  <span className="nums text-sm font-semibold text-foreground">
                    {fmtCoin(chosenTopUp, coin)}
                    {chosenTopUp > round(Number(balance) || 0, coin) ? ' · over your balance' : ''}
                  </span>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy || !canPropose}
                  onClick={propose}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
                >
                  {busy ? 'Proposing…' : 'Propose raise'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPickerOpen(false);
                    setSelected(null);
                    setCustom('');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold transition hover:border-primary/40 hover:text-primary disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
