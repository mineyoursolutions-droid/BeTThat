import { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import CoinMark from '@/components/CoinMark';
import DepositCard from '@/components/wallet/DepositCard';
import WithdrawCard from '@/components/wallet/WithdrawCard';
import SignupBonusCard from '@/components/wallet/SignupBonusCard';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { COINS, fmtCoin, fmtUsd, toUsd } from '@/lib/demo';

const TX_TONE = {
  pending: 'text-primary',
  awaiting_tx: 'text-primary',
  verifying: 'text-primary',
  confirmed: 'text-win',
  paid: 'text-win',
  expired: 'text-live',
  failed: 'text-live',
  rejected: 'text-live',
};

const KIND_LABEL = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal released',
  withdrawal_hold: 'Withdrawal held',
  stake: 'Stake escrowed',
  payout: 'Winnings paid',
  refund: 'Refund',
  fee: 'Operator fee',
};

export default function WalletPage() {
  const { user } = useAuth();
  const [coin, setCoin] = useState('USDT');
  const [wallets, setWallets] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [ledger, setLedger] = useState([]);

  const load = useCallback(async () => {
    if (!user) return;
    const [w, a, t, l] = await Promise.all([
      base44.entities.Wallet.filter({ user_id: user.id }, { limit: 20 }),
      base44.entities.DepositAddress.filter({ active: true }, { limit: 20 }),
      base44.entities.CryptoTransaction.filter({ user_id: user.id }, { sort: '-created_date', limit: 25 }),
      base44.entities.LedgerEntry.filter({ user_id: user.id }, { sort: '-created_date', limit: 25 }),
    ]);
    setWallets(w.items || []);
    setAddresses(a.items || []);
    setTransactions(t.items || []);
    setLedger(l.items || []);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const balanceOf = (ticker) => (wallets || []).find((w) => w.coin === ticker) || { available: 0, locked: 0 };
  const active = balanceOf(coin);
  const totalUsd = (wallets || []).reduce((sum, w) => sum + toUsd(w.available, w.coin), 0);

  return (
    <PullToRefresh onRefresh={load}>
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Wallet</p>
      <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[38px]">Balances</h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
        One balance per coin. Stakes move into escrow when you wager and return with winnings on settlement.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {COINS.map((c) => {
          const b = balanceOf(c.ticker);
          return (
            <button
              key={c.ticker}
              type="button"
              onClick={() => setCoin(c.ticker)}
              className={`rounded-2xl border p-4 text-left transition ${
                coin === c.ticker ? 'border-primary/45 bg-primary/[0.06]' : 'border-border bg-card hover:border-border/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <CoinMark ticker={c.ticker} size="sm" />
                <span className="text-sm uppercase tracking-[0.14em] text-muted-foreground">{c.ticker}</span>
              </div>
              <p className="nums mt-3 text-[17px] font-semibold text-foreground">{fmtCoin(b.available, c.ticker)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">≈ {fmtUsd(toUsd(b.available, c.ticker))}</p>
              {Number(b.locked) > 0 ? (
                <p className="nums mt-2 inline-flex items-center gap-1 text-sm text-primary">
                  <Lock className="h-2.5 w-2.5" />
                  {fmtCoin(b.locked, c.ticker)} held
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Total available ≈ <span className="nums font-semibold text-foreground">{fmtUsd(totalUsd)}</span>
      </p>

      <div className="mt-6">
        <SignupBonusCard onClaimed={load} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <DepositCard addresses={addresses} preferredCoin={coin} onSubmitted={load} />
        <WithdrawCard coin={coin} available={active.available} onSubmitted={load} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-4 text-[14px] font-semibold">Deposits & withdrawals</h2>
          {transactions.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">No crypto transfers yet.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize text-foreground">{t.kind}</p>
                    <p className="nums truncate text-sm text-muted-foreground">
                      {t.tx_hash ? t.tx_hash.slice(0, 18) + '…' : t.address ? t.address.slice(0, 18) + '…' : '—'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="nums text-sm font-semibold text-foreground">{fmtCoin(t.amount, t.coin)}</p>
                    <p
                      className={`text-sm font-semibold uppercase tracking-[0.12em] ${TX_TONE[t.status] || 'text-muted-foreground'}`}
                    >
                      {String(t.status).replace('_', ' ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-4 text-[14px] font-semibold">Ledger</h2>
          {ledger.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">Every stake and payout will appear here.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {ledger.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {String(entry.description || '').startsWith('Sign-up bonus')
                        ? 'Sign-up bonus'
                        : KIND_LABEL[entry.kind] || entry.kind}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{entry.description}</p>
                  </div>
                  <p
                    className={`nums shrink-0 text-sm font-semibold ${
                      Number(entry.amount) < 0 ? 'text-foreground' : 'text-win'
                    }`}
                  >
                    {Number(entry.amount) > 0 ? '+' : ''}
                    {fmtCoin(entry.amount, entry.coin)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
    </PullToRefresh>
  );
}