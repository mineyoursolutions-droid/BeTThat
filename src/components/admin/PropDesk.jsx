import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import MobileSelect from '@/components/mobile/MobileSelect';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { fmtCoin, gameBySlug } from '@/lib/demo';
import { propState } from '@/lib/props';

export default function PropDesk() {
  const { toast } = useToast();
  const [matches, setMatches] = useState([]);
  const [markets, setMarkets] = useState(null);
  const [matchId, setMatchId] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [matchPage, marketPage] = await Promise.all([
      base44.entities.Match.filter(
        { status: { $in: ['open', 'matched', 'in_play', 'awaiting_result'] } },
        { sort: '-created_date', limit: 40 },
      ),
      base44.entities.PropMarket.list({ sort: '-created_date', limit: 60 }),
    ]);
    const rows = matchPage.items || [];
    setMatches(rows);
    setMatchId((current) => current || (rows[0] ? rows[0].id : ''));
    setMarkets(marketPage.items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke('createPropMarket', { match_id: matchId, question });
      toast({ title: 'Prop market live', description: 'Spectators can back it right away.' });
      setQuestion('');
      load();
    } catch (err) {
      toast({
        title: 'Could not open that market',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (market, result) => {
    setBusy(true);
    try {
      await base44.functions.invoke('resolvePropMarket', { market_id: market.id, result });
      toast({
        title: result === 'void' ? 'Market voided' : 'Market resolved',
        description: result === 'void' ? 'Every stake was refunded.' : 'Winning stakes were paid out.',
      });
      load();
    } catch (err) {
      toast({
        title: 'Could not resolve that market',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const open = (markets || []).filter((m) => m.status === 'open');
  const closed = (markets || []).filter((m) => m.status !== 'open');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-[14px] font-semibold">Open a prop market</h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
          Frame the prop as a yes / no question. Spectator stakes are escrowed and settle from the pool.
        </p>

        <div className="mt-4 space-y-3">
          <MobileSelect
            label="Match"
            value={matchId}
            onValueChange={setMatchId}
            placeholder={matches.length === 0 ? 'No active matches' : 'Choose a match'}
            options={matches.map((m) => ({
              value: m.id,
              label: `${m.title} — ${(gameBySlug(m.game_slug) || {}).name || m.game_slug} · ${m.coin}`,
            }))}
          />

          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will the match go the distance? (yes / no)"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          />

          <button
            type="button"
            disabled={busy || !matchId || question.trim().length < 6}
            onClick={create}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[12.5px] font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
            Post market
          </button>
        </div>
      </div>

      <MarketGroup title="Open markets" markets={open} busy={busy} onResolve={resolve} resolving />
      <MarketGroup title="Closed markets" markets={closed} busy={busy} onResolve={resolve} />
    </div>
  );
}

function MarketGroup({ title, markets, busy, onResolve, resolving }) {
  return (
    <div>
      <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
      {markets.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
          Nothing here yet.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {markets.map((m) => {
            const state = propState(m);
            return (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug text-foreground">{m.question}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {m.match_title} · {m.coin} · Yes {fmtCoin(m.yes_pool, m.coin)} / No {fmtCoin(m.no_pool, m.coin)} ·{' '}
                      {m.bettor_count || 0} backers
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {state.label}
                  </span>
                </div>

                {resolving && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onResolve(m, 'yes')}
                      className="rounded-full border border-win/40 bg-win/[0.08] px-3 py-1.5 text-[11.5px] font-semibold text-win transition hover:bg-win/[0.14] disabled:opacity-50"
                    >
                      Pay Yes
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onResolve(m, 'no')}
                      className="rounded-full border border-live/40 bg-live/[0.08] px-3 py-1.5 text-[11.5px] font-semibold text-live transition hover:bg-live/[0.14] disabled:opacity-50"
                    >
                      Pay No
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onResolve(m, 'void')}
                      className="rounded-full border border-border px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
                    >
                      Void · refund
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}