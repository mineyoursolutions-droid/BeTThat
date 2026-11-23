import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Spade, Eye, Play } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import CoinMark from '@/components/CoinMark';
import { COINS, fmtCoin } from '@/lib/demo';

// Dead Seven lobby — Chang Gang poker. Open a new table (5 players
// max, buy-in in the match coin) or take a seat at an open one.
// Tables in play can be watched live.
export default function DeadSevenLobby() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: 'Dead Seven table', coin: 'USDT', stake: '10' });

  const load = useCallback(async () => {
    try {
      const page = await base44.entities.PokerTable.filter(
        { game_slug: 'dead-seven' },
        { sort: '-created_date', limit: 20 },
      );
      setTables(page.items || []);
    } catch {
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    if (!user) return;
    const page = await base44.entities.Wallet.filter({ user_id: user.id }, { limit: 20 });
    setWallets(page.items || []);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const balance = (wallets.find((w) => w.coin === form.coin) || {}).available || 0;
  const stakeNum = Number(form.stake || 0);
  const betUnit = stakeNum > 0 ? stakeNum / 10 : 0;

  const createTable = async () => {
    if (!(stakeNum > 0)) {
      toast({ title: 'Set a buy-in', description: 'The buy-in has to be greater than zero.', variant: 'destructive' });
      return;
    }
    if (stakeNum > balance) {
      toast({ title: 'Not enough balance', description: 'Fund your wallet first.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('createDeadSevenTable', {
        title: form.title.trim() || 'Dead Seven table',
        coin: form.coin,
        stake: stakeNum,
      });
      const table = res.data?.table || res.data;
      navigate(`/poker/dead-seven/${table.id}`);
    } catch (err) {
      toast({
        title: 'Table did not open',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const joinTable = async (tableId) => {
    setBusy(true);
    try {
      await base44.functions.invoke('joinDeadSevenTable', { table_id: tableId });
      navigate(`/poker/dead-seven/${tableId}`);
    } catch (err) {
      toast({
        title: 'Could not take a seat',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const seatCount = (table) => {
    try {
      return JSON.parse(table.players_json || '[]').length;
    } catch {
      return 0;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Chang Gang poker</p>
          <h1 className="mt-1 font-graffiti text-4xl leading-none text-foreground sm:text-5xl">Dead Seven</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Seven cards each, no draws, one betting round — then showdown. The object is to make one of
            each suit: your best 4-card one-of-each-suit hand is read both ways, and the pot splits between the best
            high hand (K-Q-J-T, one of each suit — the high wheel) and the best low hand (A-2-3-4, one of each suit —
            the low wheel).
          </p>
        </div>
        <Link
          to="/lobby"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
        >
          Back to the lobby
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Open a table */}
        <div className="h-fit overflow-hidden rounded-2xl border border-border bg-card">
          <div className="p-6">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Plus className="h-4 w-4 text-primary" />
              Open a Dead Seven table
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm uppercase tracking-[0.14em] text-muted-foreground">Table name</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none placeholder:text-muted-foreground/60"
                  placeholder="Dead Seven table"
                />
              </div>
              <div>
                <label className="text-sm uppercase tracking-[0.14em] text-muted-foreground">Buy-in coin</label>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {COINS.map((c) => (
                    <button
                      key={c.ticker}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, coin: c.ticker }))}
                      className={`rounded-xl border p-3 text-center transition ${
                        form.coin === c.ticker
                          ? 'border-primary/50 bg-primary/[0.08]'
                          : 'border-border hover:border-border/80'
                      }`}
                    >
                      <span className="text-sm font-bold text-foreground">{c.ticker}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm uppercase tracking-[0.14em] text-muted-foreground">Buy-in per player</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5">
                  <CoinMark ticker={form.coin} size="sm" />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.stake}
                    onChange={(e) => setForm((f) => ({ ...f, stake: e.target.value }))}
                    className="nums w-full bg-transparent text-[14px] font-semibold outline-none placeholder:text-muted-foreground/60"
                    placeholder="0.00"
                  />
                  <span className="text-sm font-semibold text-muted-foreground">{form.coin}</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Available {fmtCoin(balance, form.coin)} · Bet per round{' '}
                  <span className="nums font-semibold text-foreground">{fmtCoin(betUnit, form.coin)}</span> · 5%
                  house fee at showdown
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !(stakeNum > 0)}
                onClick={createTable}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
              >
                <Spade className="h-4 w-4" />
                {busy ? 'Opening…' : 'Open table'}
              </button>
            </div>
          </div>
        </div>

        {/* Open tables */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border/80 px-6 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Users className="h-4 w-4 text-primary" />
              Tables
            </h2>
          </div>
          {loading ? (
            <div className="space-y-3 p-6">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-background/60" />
              ))}
            </div>
          ) : tables.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No Dead Seven tables yet — open the first one and the table is yours.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {tables.map((table) => {
                const seats = seatCount(table);
                const isSeated =
                  user && JSON.parse(table.players_json || '[]').some((p) => p.user_id === user.id);
                return (
                  <li key={table.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{table.title}</p>
                      <p className="nums mt-0.5 text-sm text-muted-foreground">
                        {fmtCoin(table.stake, table.coin)} buy-in · {seats}/5 seats · Pot{' '}
                        {fmtCoin(table.pot || 0, table.coin)} · {table.creator_handle || 'Creator'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                        table.status === 'lobby'
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : table.status === 'in_play'
                            ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                            : 'border-border text-muted-foreground'
                      }`}
                    >
                      {table.status === 'lobby' ? 'Open' : table.status === 'in_play' ? 'In play' : table.status}
                    </span>
                    {table.status === 'lobby' && !isSeated && seats < 5 ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => joinTable(table.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Take a seat
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/poker/dead-seven/${table.id}`)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {isSeated ? 'Back to table' : 'Watch'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
