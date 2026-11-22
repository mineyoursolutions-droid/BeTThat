import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { fmtCoin } from '@/lib/demo';
import { gameLook } from '@/lib/matches';
import ProofChip from '@/components/admin/ProofChip';

export default function SettlementQueue({ signal = 0 }) {
  const { toast } = useToast();
  const [matches, setMatches] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const page = await base44.entities.Match.filter(
      { status: { $in: ['matched', 'in_play', 'awaiting_result'] } },
      { sort: '-created_date', limit: 50 },
    );
    setMatches(page.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load, signal]);

  const settle = async (match, winner) => {
    setBusyId(match.id);
    try {
      await base44.functions.invoke('settleMatch', { match_id: match.id, winner });
      toast({ title: 'Match settled', description: 'Stakes and spectator pools have been paid out.' });
      load();
    } catch (err) {
      toast({ title: 'Settlement failed', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (match) => {
    setBusyId(match.id);
    try {
      await base44.functions.invoke('settleMatch', { match_id: match.id, action: 'cancel' });
      toast({ title: 'Match cancelled', description: 'Every stake was refunded in full.' });
      load();
    } catch (err) {
      toast({ title: 'Could not cancel', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  if (matches === null) return <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />;
  if (matches.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">Nothing to settle right now.</p>;
  }

  return (
    <div className="space-y-2.5">
      {matches.map((m) => {
        const game = gameLook(m.game_slug);
        return (
          <div key={m.id} className="rounded-xl border border-border bg-card px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to={`/match/${m.id}`} className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  <span className="mr-2 rounded border border-border px-1 py-0.5 font-mono text-sm text-muted-foreground">
                    {game.monogram}
                  </span>
                  {m.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {m.creator_handle} vs {m.challenger_handle || 'open seat'} · {fmtCoin(m.stake, m.coin)}
                </p>
              </Link>
              <button
                type="button"
                disabled={busyId === m.id}
                onClick={() => cancel(m)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm font-semibold text-muted-foreground transition hover:text-live disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                Refund
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              <ProofChip label={m.creator_handle} uri={m.creator_proof_uri} kind={m.creator_proof_kind} />
              <ProofChip label={m.challenger_handle} uri={m.challenger_proof_uri} kind={m.challenger_proof_kind} />
            </div>

            {m.reported_winner ? (
              <p className={`mt-2 text-sm ${m.result_disputed ? 'text-live' : 'text-primary'}`}>
                {m.reported_by_handle || 'A player'} reported{' '}
                {m.reported_winner === 'creator' ? m.creator_handle : m.challenger_handle} won
                {m.result_disputed ? ' · disputed' : ' · awaiting confirmation'}
              </p>
            ) : null}

            {m.challenger_id ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => settle(m, 'creator')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
                >
                  {busyId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {m.creator_handle} won
                </button>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => settle(m, 'challenger')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-win/10 px-3 py-2 text-sm font-semibold text-win transition hover:bg-win/20 disabled:opacity-50"
                >
                  {m.challenger_handle} won
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Waiting for a challenger — only a refund applies.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}