import CoinMark from '@/components/CoinMark';
import { fmtCoin } from '@/lib/demo';

export default function CoinTable({ byCoin }) {
  if (!byCoin.length) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-[1.1fr_repeat(3,1fr)] gap-2 border-b border-border px-4 py-2.5 text-sm uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-[1.1fr_repeat(4,1fr)]">
        <span>Coin</span>
        <span className="text-right">Record</span>
        <span className="text-right">Staked</span>
        <span className="text-right">Spectator</span>
        <span className="hidden text-right sm:block">Net</span>
      </div>
      {byCoin.map((c) => {
        const net = c.net + c.spectator_net;
        return (
          <div
            key={c.coin}
            className="grid grid-cols-[1.1fr_repeat(3,1fr)] items-center gap-2 border-b border-border/60 px-4 py-3 last:border-0 sm:grid-cols-[1.1fr_repeat(4,1fr)]"
          >
            <div className="flex items-center gap-2">
              <CoinMark ticker={c.coin} size="sm" />
              <span className="text-sm font-semibold text-foreground">{c.coin}</span>
            </div>
            <span className="nums text-right text-sm text-foreground">
              {c.wins}W · {c.matches - c.wins}L
            </span>
            <span className="nums text-right text-sm text-foreground">{fmtCoin(c.staked, c.coin)}</span>
            <span className="nums text-right text-sm text-muted-foreground">
              {c.spectator_staked ? fmtCoin(c.spectator_staked, c.coin) : '—'}
            </span>
            <span
              className={`nums hidden text-right text-sm font-semibold sm:block ${
                net >= 0 ? 'text-win' : 'text-live'
              }`}
            >
              {net >= 0 ? '+' : ''}
              {fmtCoin(net, c.coin)}
            </span>
          </div>
        );
      })}
    </div>
  );
}