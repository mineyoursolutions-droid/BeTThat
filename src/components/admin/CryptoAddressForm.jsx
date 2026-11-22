import { useState } from 'react';
import { Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { COINS } from '@/lib/demo';
import { looksLikeAddress, networkById, networksForCoin } from '@/lib/crypto';
import MobileSelect from '@/components/mobile/MobileSelect';

export default function CryptoAddressForm({ onSaved }) {
  const { toast } = useToast();
  const [coin, setCoin] = useState('USDC');
  const [network, setNetwork] = useState('base');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const options = networksForCoin(coin);

  const changeCoin = (value) => {
    setCoin(value);
    const next = networksForCoin(value);
    setNetwork(next.length ? next[0].id : '');
  };

  const save = async (e) => {
    e.preventDefault();
    if (!looksLikeAddress(network, address)) {
      toast({
        title: 'That address does not look right',
        description: `Check the ${networkById(network)?.label || network} address and try again.`,
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      await base44.entities.DepositAddress.create({ coin, network, address: address.trim(), active: true });
      toast({ title: 'Address saved', description: `${coin} on ${networkById(network)?.label || network}` });
      setAddress('');
      onSaved();
    } catch (err) {
      toast({ title: 'Could not save that address', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-[13px] font-semibold text-foreground">Add an address</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        One address per coin and network. Only active addresses can create payment requests.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Coin</span>
          <MobileSelect label="Coin" value={coin} onValueChange={changeCoin} options={COINS.map((c) => ({ value: c.ticker, label: c.ticker }))} className="mt-1" />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Network</span>
          <MobileSelect label="Network" value={network} onValueChange={setNetwork} options={options.map((n) => ({ value: n.id, label: n.label }))} className="mt-1" />
        </label>
      </div>

      {networkById(network)?.hint ? (
        <p className="mt-2 text-[10.5px] text-muted-foreground">{networkById(network).hint}</p>
      ) : null}

      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Deposit address"
        className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-[11px] outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
      />

      <button
        type="submit"
        disabled={busy || !network}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-[11.5px] font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
      >
        <Plus className="h-3 w-3" />
        {busy ? 'Saving…' : 'Add address'}
      </button>
    </form>
  );
}