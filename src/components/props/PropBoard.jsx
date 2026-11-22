import { useCallback, useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PropMarketCard from '@/components/props/PropMarketCard';

export default function PropBoard({ match, wallets, user, onPlaced }) {
  const [markets, setMarkets] = useState(null);
  const [bets, setBets] = useState([]);

  const balance = (wallets.find((w) => w.coin === match.coin) || {}).available || 0;
  const closed = ['settled', 'cancelled'].includes(match.status);
  const isPlayer = user && (user.id === match.creator_id || user.id === match.challenger_id);

  const load = useCallback(async () => {
    const page = await base44.entities.PropMarket.filter({ match_id: match.id }, { sort: '-created_date', limit: 20 });
    setMarkets(page.items || []);
    if (user) {
      const mine = await base44.entities.PropBet.filter({ match_id: match.id, user_id: user.id }, { limit: 50 });
      setBets(mine.items || []);
    }
  }, [match.id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    onPlaced();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold">Prop markets</h2>
        <span className="text-sm text-muted-foreground">Yes / No · 5% operator fee on the pool</span>
      </div>

      {markets === null ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-background/60" />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-dashed border-border px-4 py-5">
          <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-relaxed text-muted-foreground">
            No props posted on this match yet. Operators add side markets — first blood, total maps, exact score — as
            the match gets closer.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {markets.map((market) => (
            <PropMarketCard
              key={market.id}
              market={market}
              balance={balance}
              bets={bets.filter((b) => b.market_id === market.id)}
              canBet={Boolean(user) && !isPlayer}
              closed={closed}
              onPlaced={refresh}
            />
          ))}
        </div>
      )}

      {isPlayer && (
        <p className="mt-3 text-sm text-muted-foreground">
          You are in this match, so prop betting is closed to you.
        </p>
      )}
    </div>
  );
}