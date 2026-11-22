import { useCallback, useEffect, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import CoinMark from '@/components/CoinMark';
import { fmtCoin } from '@/lib/demo';

export default function ReviewQueue({ signal = 0 }) {
  const { toast } = useToast();
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const page = await base44.entities.CryptoTransaction.filter(
      { status: { $in: ['pending', 'failed', 'expired'] } },
      { sort: 'created_date', limit: 50 },
    );
    setItems(page.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load, signal]);

  const review = async (tx, action) => {
    setBusyId(tx.id);
    try {
      await base44.functions.invoke('adminReviewTransaction', { transaction_id: tx.id, action });
      toast({ title: action === 'approve' ? 'Approved' : 'Rejected', description: `${tx.kind} ${tx.amount} ${tx.coin}` });
      load();
    } catch (err) {
      toast({
        title: 'Review failed',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (items === null) return <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />;
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">No transfers waiting on you.</p>;
  }

  return (
    <div className="space-y-2.5">
      {items.map((tx) => (
        <div key={tx.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
          <CoinMark ticker={tx.coin} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold capitalize text-foreground">
              {tx.kind} · {fmtCoin(tx.amount, tx.coin)}
              {tx.status !== 'pending' ? (
                <span className="ml-2 text-sm font-semibold uppercase tracking-[0.12em] text-live">
                  {String(tx.status).replace('_', ' ')}
                </span>
              ) : null}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {tx.user_handle} · {tx.kind === 'deposit' ? tx.tx_hash : tx.address}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={busyId === tx.id}
              onClick={() => review(tx, 'approve')}
              className="inline-flex items-center gap-1.5 rounded-full bg-win/15 px-3 py-1.5 text-sm font-semibold text-win transition hover:bg-win/25 disabled:opacity-50"
            >
              {busyId === tx.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              {tx.kind === 'deposit' ? 'Confirm' : 'Release'}
            </button>
            <button
              type="button"
              disabled={busyId === tx.id}
              onClick={() => review(tx, 'reject')}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-live disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}