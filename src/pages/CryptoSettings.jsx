import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import CryptoAddressForm from '@/components/admin/CryptoAddressForm';
import CryptoAddressRow from '@/components/admin/CryptoAddressRow';
import { NETWORKS } from '@/lib/crypto';
import MobileBackBar from '@/components/mobile/MobileBackBar';
import PullToRefresh from '@/components/mobile/PullToRefresh';

export default function CryptoSettings() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);

  const load = useCallback(async () => {
    const page = await base44.entities.DepositAddress.list({ limit: 100 });
    setRows(page.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) return null;

  if (user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <ShieldAlert className="mx-auto h-7 w-7 text-muted-foreground" />
        <h1 className="mt-4 text-[24px] font-extrabold">Owners only</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Deposit addresses decide where player funds land. Only an admin account can add or deactivate them.
        </p>
        <Link to="/wallet" className="mt-6 inline-block rounded-full border border-border px-4 py-2.5 text-sm font-semibold">
          Back to the wallet
        </Link>
      </div>
    );
  }

  const networkOrder = (id) => {
    const index = NETWORKS.findIndex((n) => n.id === id);
    return index < 0 ? NETWORKS.length : index;
  };

  const sorted = [...(rows || [])].sort(
    (a, b) => networkOrder(a.network) - networkOrder(b.network) || String(a.coin).localeCompare(String(b.coin)),
  );

  return (
    <PullToRefresh onRefresh={load}>
    <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <MobileBackBar to="/admin" label="Operator desk" />
      <Link to="/admin" className="hidden items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground md:inline-flex">
        <ArrowLeft className="h-3.5 w-3.5" />
        Operator desk
      </Link>

      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Crypto settings</p>
      <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[36px]">Deposit addresses</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Every coin and network a player can fund from. Requests are refused for any pair without an active address, and
        deposits are verified against the address stored on the quote.
      </p>

      <div className="mt-6">
        <CryptoAddressForm onSaved={load} />
      </div>

      <div className="mt-6 space-y-2.5">
        {rows === null ? (
          <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
        ) : sorted.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
            No deposit addresses yet. Players cannot fund until you add one.
          </p>
        ) : (
          sorted.map((row) => <CryptoAddressRow key={row.id} row={row} onChanged={load} />)
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">How verification works</h2>
        <ul className="mt-2 space-y-1.5">
          {NETWORKS.map((n) => (
            <li key={n.id} className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{n.label}</span> · {n.required} confirmation
              {n.required === 1 ? '' : 's'} before a deposit is credited. {n.hint}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground/80">
          Anything the chain check cannot match stays in the transfer queue for manual approval.
        </p>
      </div>
    </div>
    </PullToRefresh>
  );
}