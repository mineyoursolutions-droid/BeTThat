import { useState } from 'react';
import { Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import CoinMark from '@/components/CoinMark';
import { fmtCoin } from '@/lib/demo';
import { propOdds, propState } from '@/lib/props';

const TONES = {
  open: 'border-border bg-background/60 text-muted-foreground',
  win: 'border-win/40 bg-win/[0.08] text-win',
  loss: 'border-live/40 bg-live/[0.08] text-live',
  muted: 'border-border bg-background/60 text-muted-foreground',
};

export default function PropMarketCard({ market, balance, bets, canBet, closed, onPlaced }) {
  const { toast } = useToast();
  const [side, setSide] = useState('yes');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const odds = propOdds(market);
  const yes = Number(market.yes_pool || 0);
  const no = Number(market.no_pool || 0);
  const total = yes + no;
  const split = total > 0 ? Math.round((yes / total) * 100) : 50;
  const state = propState(market);

  const place = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke('placePropBet', {
        market_id: market.id,
        side,
        amount: Number(amount),
      });
      toast({ title: 'Prop bet locked', description: 'Your stake is held in escrow with this market.' });
      setAmount('');
      onPlaced();
    } catch (err) {
      toast({
        title: 'Could not place that prop bet',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-[85%] text-[13px] font-semibold leading-snug text-foreground">{market.question}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${TONES[state.tone]}`}>
          {state.label}
        </span>
      </div>

      <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full bg-win" style={{ width: `${split}%` }} />
        <div className="h-full bg-live/70" style={{ width: `${100 - split}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10.5px] font-semibold">
        <span className="text-win">Yes · {fmtCoin(yes, market.coin)}</span>
        <span className="text-live/90">No · {fmtCoin(no, market.coin)}</span>
      </div>

      {bets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {bets.map((b) => (
            <span
              key={b.id}
              className="rounded-md border border-border bg-card px-2 py-1 text-[10.5px] text-muted-foreground"
            >
              <span className="nums font-semibold text-foreground">{fmtCoin(b.amount, market.coin)}</span> on{' '}
              {b.side === 'yes' ? 'Yes' : 'No'} · {b.status}
              {b.status === 'won' ? ` · ${fmtCoin(b.payout, market.coin)}` : ''}
            </span>
          ))}
        </div>
      )}

      {canBet && !closed && market.status === 'open' && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {['yes', 'no'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={`rounded-lg border p-2 text-left transition ${
                  side === s ? 'border-primary/50 bg-primary/[0.08]' : 'border-border hover:border-border/80'
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{s === 'yes' ? 'Yes' : 'No'}</p>
                <p className="nums text-[13px] font-semibold text-primary">{odds[s].toFixed(2)}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2">
            <CoinMark ticker={market.coin} size="sm" />
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="nums w-full bg-transparent text-[13px] font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
            />
            <span className="text-[10.5px] font-semibold text-muted-foreground">{market.coin}</span>
          </div>

          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span>Available {fmtCoin(balance, market.coin)}</span>
            <span>{market.bettor_count || 0} backers</span>
          </div>

          <button
            type="button"
            disabled={busy || !(Number(amount) > 0)}
            onClick={place}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/[0.08] px-3 py-2 text-[12px] font-semibold text-primary transition hover:bg-primary/[0.14] disabled:opacity-50"
          >
            <Lock className="h-3.5 w-3.5" />
            {busy ? 'Locking…' : `Back ${side === 'yes' ? 'Yes' : 'No'}`}
          </button>
        </div>
      )}
    </div>
  );
}