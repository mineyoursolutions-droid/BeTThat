import { useState } from 'react';
import { Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import CoinMark from '@/components/CoinMark';
import { looksLikeAddress, networkById, requiredFor } from '@/lib/crypto';

export default function CryptoAddressRow({ row, onChanged }) {
  const { toast } = useToast();
  const [address, setAddress] = useState(row.address || '');
  const [busy, setBusy] = useState(false);
  const network = networkById(row.network);

  const save = async () => {
    if (!looksLikeAddress(row.network, address)) {
      toast({ title: 'That address does not look right', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await base44.entities.DepositAddress.update(row.id, { address: address.trim() });
      toast({ title: 'Address updated' });
      onChanged();
    } catch (err) {
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    setBusy(true);
    try {
      await base44.entities.DepositAddress.update(row.id, { active: !row.active });
      onChanged();
    } catch (err) {
      toast({ title: 'Could not update', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-xl border bg-card px-4 py-3 ${row.active ? 'border-border' : 'border-border/60 opacity-70'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <CoinMark ticker={row.coin} size="sm" />
        <span className="text-[12px] font-semibold text-foreground">{row.coin}</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">
          {network ? network.label : row.network || 'no network'}
        </span>
        <span className="text-[10px] text-muted-foreground">{requiredFor(row.network)} confirmations</span>
        <button
          type="button"
          disabled={busy}
          onClick={toggle}
          className={`ml-auto rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition disabled:opacity-50 ${
            row.active ? 'border-win/40 text-win' : 'border-border text-muted-foreground'
          }`}
        >
          {row.active ? 'Active' : 'Inactive'}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Deposit address"
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-[10.5px] outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        <button
          type="button"
          disabled={busy || address === row.address}
          onClick={save}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-40"
        >
          <Save className="h-3 w-3" />
          Save
        </button>
      </div>
    </div>
  );
}