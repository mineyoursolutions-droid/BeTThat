import CoinMark from '@/components/CoinMark';
import { networkById, pairKey } from '@/lib/crypto';

export default function DepositQuoteForm({ pairs, pair, onPair, amount, onAmount, onSubmit, busy }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-sm uppercase tracking-[0.14em] text-muted-foreground">Coin & network</label>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
          {pairs.map((row) => {
            const selected = pair && pairKey(pair.coin, pair.network) === pairKey(row.coin, row.network);
            const network = networkById(row.network);
            return (
              <button
                key={row.id || pairKey(row.coin, row.network)}
                type="button"
                onClick={() => onPair({ coin: row.coin, network: row.network })}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                  selected ? 'border-primary/45 bg-primary/[0.07]' : 'border-border bg-background hover:border-border/80'
                }`}
              >
                <CoinMark ticker={row.coin} size="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{row.coin}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {network ? network.label : row.network}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm uppercase tracking-[0.14em] text-muted-foreground">Amount you will send</label>
        <input
          required
          type="number"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => onAmount(e.target.value)}
          placeholder="0.00"
          className="nums mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        {pair ? (
          <p className="mt-1.5 text-sm text-muted-foreground">
            Quoted in {pair.coin}, priced in USD for {networkById(pair.network) ? networkById(pair.network).label : pair.network}.
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={busy || !pair}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/[0.08] px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/[0.14] disabled:opacity-50"
      >
        {busy ? 'Creating payment request…' : 'Create payment request'}
      </button>
    </form>
  );
}