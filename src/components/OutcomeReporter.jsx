import { useState } from 'react';
import { Loader2, ShieldAlert, CheckCircle2, Trophy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const ELIGIBLE = ['matched', 'in_play', 'awaiting_result'];

export default function OutcomeReporter({ match, user, onChanged }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const side = match.creator_id === user.id ? 'creator' : match.challenger_id === user.id ? 'challenger' : null;
  if (!side || !ELIGIBLE.includes(match.status)) return null;

  const other = side === 'creator' ? 'challenger' : 'creator';
  const nameOf = (s) => (s === 'creator' ? match.creator_handle : match.challenger_handle);
  const reportedByMe = match.reported_by_id === user.id;

  const send = async (payload) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('reportOutcome', { match_id: match.id, ...payload });
      onChanged?.(res.data.match);
      if (res.data.match?.status === 'settled') {
        toast({ title: 'Match settled', description: 'Both players agreed — the pot has been paid out.' });
      } else if (res.data.disputed) {
        toast({ title: 'Result disputed', description: 'The operator will settle this one.' });
      } else {
        toast({ title: 'Result sent', description: 'Waiting on your opponent to confirm.' });
      }
    } catch (err) {
      toast({ title: 'Could not report', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        <h2 className="text-[14px] font-semibold">Report the result</h2>
      </div>

      {match.result_disputed ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-live/30 bg-live/[0.06] p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-live" />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            You and your opponent reported different winners. An operator will review the evidence and settle manually.
          </p>
        </div>
      ) : match.reported_winner && reportedByMe ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.05] p-3.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            You reported <span className="font-semibold text-foreground">{nameOf(match.reported_winner)}</span> won. Waiting
            for your opponent to confirm before the pot is released.
          </p>
        </div>
      ) : match.reported_winner ? (
        <div className="mt-3">
          <div className="rounded-xl border border-primary/25 bg-primary/[0.05] p-3.5">
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              {match.reported_by_handle || 'Your opponent'} reported{' '}
              <span className="font-semibold text-foreground">{nameOf(match.reported_winner)}</span> won.
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => send({ action: 'confirm' })}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-win/10 px-3 py-2 text-[11.5px] font-semibold text-win transition hover:bg-win/20 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Confirm and settle
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => send({ action: 'dispute' })}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold text-muted-foreground transition hover:text-live disabled:opacity-50"
            >
              Dispute
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Name the winner. If you both report the same player the pot pays out instantly — otherwise an operator settles it.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => send({ action: 'report', winner: side })}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-[11.5px] font-semibold text-primary transition hover:bg-primary/20 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              I won
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => send({ action: 'report', winner: other })}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            >
              Opponent won
            </button>
          </div>
        </>
      )}
    </div>
  );
}