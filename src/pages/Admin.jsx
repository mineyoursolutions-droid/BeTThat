import { useState } from 'react';
import { ShieldAlert, ArrowLeftRight, Gavel, Wallet, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import ReviewQueue from '@/components/admin/ReviewQueue';
import SettlementQueue from '@/components/admin/SettlementQueue';
import PropDesk from '@/components/admin/PropDesk';
import MobileBackBar from '@/components/mobile/MobileBackBar';
import PullToRefresh from '@/components/mobile/PullToRefresh';

const TABS = [
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight, blurb: 'Confirm deposits and release withdrawals once you have verified the transfer on chain.' },
  { id: 'settlement', label: 'Settlement', icon: Gavel, blurb: 'Settle a match once the result is verified, or refund the stakes.' },
  { id: 'props', label: 'Props', icon: Ticket, blurb: 'Post yes / no side markets on a live match, then pay out or void them.' },
];

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState('transfers');
  const [signal, setSignal] = useState(0);

  const refresh = async () => {
    // The queues reload whenever `signal` changes.
    setSignal((n) => n + 1);
  };

  if (!user) return null;

  if (user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <ShieldAlert className="mx-auto h-7 w-7 text-muted-foreground" />
        <h1 className="mt-4 text-[24px] font-extrabold">Operators only</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Settling matches and releasing payouts needs an operator account. Ask the app owner to give your account the
          admin role.
        </p>
        <Link to="/lobby" className="mt-6 inline-block rounded-full border border-border px-4 py-2.5 text-sm font-semibold">
          Back to the lobby
        </Link>
      </div>
    );
  }

  const active = TABS.find((t) => t.id === tab);

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <MobileBackBar to="/lobby" label="Lobby" />
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Operator desk</p>
      <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[38px]">
        Settle the book
      </h1>

      <div className="mt-7 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition md:min-h-0 ${
              tab === id ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <Link
          to="/crypto-settings"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground md:min-h-0"
        >
          <Wallet className="h-3.5 w-3.5" />
          Crypto settings
        </Link>
      </div>

      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{active.blurb}</p>

      <div className="mt-6">
        {tab === 'transfers' && <ReviewQueue signal={signal} />}
        {tab === 'settlement' && <SettlementQueue signal={signal} />}
        {tab === 'props' && <PropDesk signal={signal} />}
      </div>
    </div>
    </PullToRefresh>
  );
}