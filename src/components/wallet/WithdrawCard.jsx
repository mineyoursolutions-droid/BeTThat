import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import CoinMark from '@/components/CoinMark';
import { fmtCoin } from '@/lib/demo';

export default function WithdrawCard({ coin, available, onSubmitted }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await base44.functions.invoke('requestWithdrawal', { coin, amount: Number(amount), address: address.trim() });
      toast({ title: 'Withdrawal requested', description: 'The amount is held until the operator releases it.' });
      setAmount('');
      setAddress('');
      onSubmitted();
    } catch (err) {
      toast({
        title: 'Could not request that withdrawal',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-[14px] font-semibold">
        <CoinMark ticker={coin} size="sm" />
        Withdraw {coin}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Available <span className="nums font-semibold text-foreground">{fmtCoin(available, coin)}</span>. Requests are
        reviewed before payout, and funds stay held until then.
      </p>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label className="text-sm uppercase tracking-[0.14em] text-muted-foreground">Amount</label>
          <input
            required
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="nums mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
        </div>
        <div>
          <label className="text-sm uppercase tracking-[0.14em] text-muted-foreground">Payout address</label>
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={`Your ${coin} wallet address`}
            className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          {busy ? 'Requesting…' : 'Request withdrawal'}
        </button>
      </form>
    </div>
  );
}