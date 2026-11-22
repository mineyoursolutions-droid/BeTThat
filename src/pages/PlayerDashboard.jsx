import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toUsd } from '@/lib/demo';
import ReputationBadge, { RecordLine } from '@/components/ReputationBadge';
import StatCards from '@/components/stats/StatCards';
import ResultBars from '@/components/stats/ResultBars';
import WinLossDonut from '@/components/stats/WinLossDonut';
import NetCurve from '@/components/stats/NetCurve';
import ResultList from '@/components/stats/ResultList';
import CoinTable from '@/components/stats/CoinTable';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import DeleteAccount from '@/components/DeleteAccount';

export default function PlayerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('getPlayerStats', {});
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handle = (user && (user.full_name || String(user.email).split('@')[0])) || 'Player';
  const byCoin = data?.byCoin || [];
  const stakedUsd = byCoin.reduce((sum, c) => sum + toUsd(c.staked + c.spectator_staked, c.coin), 0);
  const netUsd = byCoin.reduce((sum, c) => sum + toUsd(c.net + c.spectator_net, c.coin), 0);

  return (
    <PullToRefresh onRefresh={load}>
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">My dashboard</p>
          <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[38px]">
            {handle}
          </h1>
          {data ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ReputationBadge profile={data.reputation} />
              <RecordLine profile={data.reputation} />
              {data.spectator.won + data.spectator.lost > 0 ? (
                <span className="text-[10.5px] text-muted-foreground">
                  Spectator bets: {data.spectator.won}W · {data.spectator.lost}L
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/bets"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-[13px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
          >
            All my wagers
          </Link>
          <DeleteAccount />
        </div>
      </div>

      {error ? (
        <div className="mt-8 rounded-2xl border border-live/30 bg-live/[0.06] px-5 py-4 text-[13px] text-live">
          {error}
        </div>
      ) : !data ? (
        <div className="mt-8 space-y-3">
          <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      ) : (
        <div className="mt-7 space-y-5">
          <StatCards totals={data.totals} stakedUsd={stakedUsd} netUsd={netUsd} />

          <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
            <Panel title="Recent match results" hint="Net result of each of your last 16 settled matches">
              {data.results.length ? <ResultBars results={data.results} /> : <EmptyChart />}
            </Panel>
            <Panel title="Win / loss" hint="Across every settled match">
              <WinLossDonut totals={data.totals} />
            </Panel>
          </div>

          <Panel title="Cumulative net" hint="Running profit and loss in USD">
            {data.results.length ? <NetCurve results={data.results} /> : <EmptyChart />}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Latest matches" hint="Newest first">
              <ResultList results={data.results} />
            </Panel>
            <Panel title="Wagering by coin" hint="Stakes you posted plus side bets you placed">
              {byCoin.length ? <CoinTable byCoin={byCoin} /> : <EmptyChart />}
            </Panel>
          </div>

          {data.totals.matches === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
              <p className="text-[14px] font-semibold text-foreground">No settled matches yet</p>
              <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                Your charts fill in automatically as matches settle.
              </p>
              <Link
                to="/lobby"
                className="mt-5 inline-block rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                Find a match
              </Link>
            </div>
          ) : null}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}

function Panel({ title, hint, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-[13px] font-semibold">{title}</h2>
      </div>
      {hint ? <p className="mb-3 text-[10.5px] text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <p className="grid h-[200px] place-items-center text-center text-[12px] text-muted-foreground">
      Nothing to chart yet.
    </p>
  );
}