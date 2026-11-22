import { useState } from 'react';
import { Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function ManualDeposit({ coin, onSubmitted }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await base44.functions.invoke('requestDeposit', { coin, amount: Number(amount), tx_hash: txHash.trim() });
      toast({ title: 'Sent for manual review', description: 'An operator credits it once the transfer checks out.' });
      setAmount('');
      setTxHash('');
      onSubmitted();
    } catch (err) {
      toast({
        title: 'Could not submit that deposit',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 border-t border-border/70 pt-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Sent from a different network or an old quote? Send it to an operator instead — the same wallet and ledger rules
        apply once it is approved.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Amount in ${coin}`}
          className="nums rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        <input
          required
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="Transaction hash"
          className="rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? 'Submitting…' : 'Send for manual review'}
      </button>
    </form>
  );
}