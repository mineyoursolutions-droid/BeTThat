import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users, MapPin, Monitor, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import StatusPill from '@/components/StatusPill';
import CoinMark from '@/components/CoinMark';
import WagerPanel from '@/components/WagerPanel';
import RaiseStakes from '@/components/RaiseStakes';
import MatchProof from '@/components/MatchProof';
import OutcomeReporter from '@/components/OutcomeReporter';
import CopyLinkButton from '@/components/CopyLinkButton';
import MatchChat from '@/components/chat/MatchChat';
import TrashTalk from '@/components/trash/TrashTalk';
import ReputationBadge, { RecordLine } from '@/components/ReputationBadge';
import FormCard from '@/components/match/FormCard';
import PropBoard from '@/components/props/PropBoard';
import { fmtCoin, fmtUsd, toUsd } from '@/lib/demo';
import { gameLook, oddsFor, statusLabel } from '@/lib/matches';
import MobileBackBar from '@/components/mobile/MobileBackBar';
import PullToRefresh from '@/components/mobile/PullToRefresh';

export default function MatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [forms, setForms] = useState({});
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const record = await base44.entities.Match.get(id);
      setMatch(record);

      const ids = [record.creator_id, record.challenger_id].filter(Boolean);
      if (ids.length) {
        const page = await base44.entities.PlayerProfile.filter({ user_id: { $in: ids } }, { limit: 4 });
        const map = {};
        (page.items || []).forEach((p) => {
          map[p.user_id] = p;
        });
        setProfiles(map);

        const loaded = await Promise.all(
          ids.map((pid) =>
            base44.functions
              .invoke('getPlayerStats', { user_id: pid })
              .then((res) => [pid, res.data])
              .catch(() => [pid, null]),
          ),
        );
        setForms(Object.fromEntries(loaded));
      }
    } catch (err) {
      setMissing(true);
    }
  }, [id]);

  const loadWallet = useCallback(async () => {
    if (!user) return;
    const page = await base44.entities.Wallet.filter({ user_id: user.id }, { limit: 20 });
    setWallets(page.items || []);
  }, [user]);

  // Defined here, before the early returns below, so hook order is stable.
  const refresh = useCallback(async () => {
    await load();
    await loadWallet();
  }, [load, loadWallet]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  // Live matches poll every 10s (paused while the tab is hidden) so both
  // players see a timeout raise, its countdown and its outcome together.
  useEffect(() => {
    if (!match || match.status !== 'in_play') return;
    const tick = () => {
      if (!document.hidden) load();
    };
    const id = window.setInterval(tick, 10000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [match?.status, load]);

  useEffect(() => {
    if (!missing) return;
    const meta = document.createElement('meta');
    meta.name = 'prerender-status-code';
    meta.content = '404';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [missing]);

  if (missing) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="text-[26px] font-extrabold">This match is no longer listed</h1>
        <p className="mt-3 text-[14px] text-muted-foreground">It may have been cancelled or removed.</p>
        <Link to="/lobby" className="mt-6 inline-block rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          Back to the lobby
        </Link>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
      </div>
    );
  }

  const game = gameLook(match.game_slug);
  const odds = oddsFor(match);
  const pc = Number(match.spectator_pool_creator || 0);
  const pch = Number(match.spectator_pool_challenger || 0);
  const total = pc + pch;
  const split = total > 0 ? Math.round((pc / total) * 100) : 50;

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <MobileBackBar to="/lobby" label="Lobby" className="-mt-8 sm:-mt-12" />
      <Link to="/lobby" className="hidden items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground md:inline-flex">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to the lobby
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className={`h-1 w-full bg-gradient-to-r ${game.gradient}`} />
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-sm tracking-[0.12em] text-muted-foreground">
                    {game.monogram}
                  </span>
                  <span className="text-sm uppercase tracking-[0.16em] text-muted-foreground">{game.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CopyLinkButton matchId={match.id} />
                  <StatusPill status={match.status} />
                </div>
              </div>

              <h1 className="mt-4 text-[26px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[32px]">
                {match.title}
              </h1>
              {match.ruleset ? (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{match.ruleset}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5" />
                  {match.platform}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {match.region}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {match.spectator_count || 0} spectators
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <SideCard
                  label="Creator"
                  handle={match.creator_handle}
                  odds={odds.creator}
                  profile={profiles[match.creator_id]}
                  active={match.winner_id === match.creator_id && match.status === 'settled'}
                />
                <SideCard
                  label="Challenger"
                  handle={match.challenger_handle}
                  odds={odds.challenger}
                  profile={profiles[match.challenger_id]}
                  active={match.winner_id === match.challenger_id && match.status === 'settled'}
                  empty={!match.challenger_id}
                />
              </div>

              <div className="mt-6 rounded-xl border border-border/80 bg-background/60 p-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Spectator pool</span>
                  <span className="nums">
                    {fmtCoin(total, match.coin)} · ≈ {fmtUsd(toUsd(total, match.coin))}
                  </span>
                </div>
                <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${split}%` }} />
                  <div className="h-full bg-win" style={{ width: `${100 - split}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-sm font-semibold">
                  <span className="text-primary">{split}% creator</span>
                  <span className="text-win">{100 - split}% challenger</span>
                </div>
              </div>
            </div>
          </div>

          <RaiseStakes
            match={match}
            wallets={wallets}
            user={user}
            onChanged={() => {
              load();
              loadWallet();
            }}
          />

          <TrashTalk match={match} user={user} />

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[14px] font-semibold">Player form</h2>
              <span className="text-sm text-muted-foreground">
                Recent settled matches · bars are net results
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FormCard
                label="Creator"
                handle={match.creator_handle}
                form={forms[match.creator_id]}
              />
              <FormCard
                label="Challenger"
                handle={match.challenger_handle}
                form={forms[match.challenger_id]}
                empty={!match.challenger_id}
              />
            </div>
          </div>

          <PropBoard
            match={match}
            wallets={wallets}
            user={user}
            onPlaced={() => {
              load();
              loadWallet();
            }}
          />

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-[14px] font-semibold">Match terms</h2>
            <dl className="mt-4 divide-y divide-border/70">
              <Row label="Stake per player" value={fmtCoin(match.stake, match.coin)} />
              <Row label="Pot" value={fmtCoin(Number(match.stake) * 2, match.coin)} />
              <Row label="Operator fee" value="5% of the pot" />
              {Number(match.raise_count || 0) > 0 ? (
                <Row label="Raises this match" value={`${match.raise_count}`} />
              ) : null}
              <Row label="Settlement" value="Both players confirm, or an operator settles" />
              <Row label="Status" value={statusLabel(match.status)} />
              {match.starts_at ? <Row label="Scheduled" value={new Date(match.starts_at).toLocaleString()} /> : null}
              {match.settle_note ? <Row label="Result" value={match.settle_note} /> : null}
            </dl>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              Both stakes stay locked in escrow until a result is confirmed. If a match is cancelled, every stake and
              spectator wager is refunded in full.
            </p>
          </div>

          <OutcomeReporter match={match} user={user} onChanged={setMatch} />

          <MatchProof match={match} user={user} onChanged={setMatch} />
        </div>

        <div className="lg:sticky lg:top-20">
          <WagerPanel
            match={match}
            wallets={wallets}
            onPlaced={() => {
              load();
              loadWallet();
            }}
          />
          <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <CoinMark ticker={match.coin} size="sm" />
              <span className="nums text-sm font-semibold">{fmtCoin(match.stake, match.coin)}</span>
            </div>
            <span className="nums text-sm text-muted-foreground">≈ {fmtUsd(toUsd(match.stake, match.coin))}</span>
          </div>
          <MatchChat match={match} user={user} />
        </div>
      </div>
    </div>
    </PullToRefresh>
  );
}

function SideCard({ label, handle, odds, profile, active, empty }) {
  return (
    <div className={`rounded-xl border p-4 ${active ? 'border-win/40 bg-win/[0.06]' : 'border-border bg-background/60'}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        {active ? <span className="text-sm font-bold uppercase tracking-[0.12em] text-win">Winner</span> : null}
      </div>
      <p className={`mt-1.5 truncate text-[14px] font-semibold ${empty ? 'text-muted-foreground' : 'text-foreground'}`}>
        {handle || 'Seat open'}
      </p>
      {!empty ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ReputationBadge profile={profile} />
          <RecordLine profile={profile} />
        </div>
      ) : null}
      <p className="nums mt-2 text-[16px] font-semibold text-primary">{odds.toFixed(2)}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}