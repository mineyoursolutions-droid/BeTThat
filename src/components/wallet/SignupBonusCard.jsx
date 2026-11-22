import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// $25 sign-up bonus in USDT, wager-only, one per account.
// - Not claimed: shows the offer + a Claim button. Claiming is
//   idempotent on the backend — safe to call from registration and
//   from here; a second claim returns the existing state.
// - Claimed, not wagered: bonus is locked out of withdrawals until
//   the player places at least one wager after claiming.
// - Claimed + wagered: bonus is fully unlocked.
export default function SignupBonusCard({ onClaimed = null }) {
  const { toast } = useToast();
  const [bonus, setBonus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    base44.functions
      .invoke('signupBonus', { action: 'status' })
      .then((res) => setBonus(res.data?.bonus || null))
      .catch(() => setBonus(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('signupBonus', { action: 'claim' });
      const next = res.data?.bonus || null;
      setBonus(next);
      if (res.data?.alreadyClaimed) {
        toast({ title: 'Bonus already claimed', description: 'One $25 bonus per account.' });
      } else {
        toast({
          title: '$25 sign-up bonus claimed',
          description: '25 USDT is in your wallet. Wager once to unlock it for withdrawal.',
        });
      }
      if (onClaimed) onClaimed();
    } catch (err) {
      toast({
        title: 'Could not claim the bonus',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (bonus === null) return null;

  if (!bonus.claimed) {
    return (
      <section className="glass-concrete rounded-2xl border border-primary/40 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <Gift className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-tag text-[17px] text-foreground">$25 sign-up bonus</h2>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                New accounts get 25 USDT on the house. It is wager-only — place a wager once and
                it unlocks for withdrawal. One bonus per account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="btn-depth inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {busy ? 'Claiming…' : 'Claim $25 in USDT'}
          </button>
        </div>
      </section>
    );
  }

  if (!bonus.wagered) {
    return (
      <section className="glass-concrete rounded-2xl border border-border px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-tag text-[17px] text-foreground">Sign-up bonus — $25, wager to unlock</h2>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                Your 25 USDT bonus is in your wallet and ready to wager. It cannot be withdrawn
                until you have placed at least one wager with it — then it unlocks in full.
              </p>
            </div>
          </div>
          <Link
            to="/lobby"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
          >
            Place a wager
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-concrete rounded-2xl border border-win/30 px-5 py-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-win/30 bg-win/10 text-win">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-tag text-[17px] text-foreground">Sign-up bonus unlocked</h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            You wagered your $25 sign-up bonus — it is now yours to keep, wager again, or
            withdraw like any other balance.
          </p>
        </div>
      </div>
    </section>
  );
}
