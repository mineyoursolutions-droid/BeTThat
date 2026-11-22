import { round, HOUSE_FEE, moveFunds, recordLedger } from './wallet.ts';

async function asRows(promise) {
  const res = await promise;
  if (Array.isArray(res)) return res;
  return (res && res.items) || [];
}

// Pays a prop market: winning side shares the whole pool less the house fee.
// A market with no winning stakes (or a void) refunds every stake in full.
export async function resolveMarket(base44, market, result, note, resolvedBy) {
  const coin = market.coin;
  const bets = await asRows(base44.asServiceRole.entities.PropBet.filter({ market_id: market.id }));
  const locked = bets.filter((b) => b.status === 'locked');

  const yesPool = round(Number(market.yes_pool || 0), coin);
  const noPool = round(Number(market.no_pool || 0), coin);
  const total = round(yesPool + noPool, coin);
  const winPool = result === 'yes' ? yesPool : noPool;
  const distributed = result !== 'void' && winPool > 0;
  const distributable = round(total - total * HOUSE_FEE, coin);
  const results = [];

  for (const bet of locked) {
    const amount = round(Number(bet.amount || 0), coin);
    let payout = 0;
    let status = 'lost';

    if (!distributed) {
      payout = amount;
      status = 'refunded';
    } else if (bet.side === result) {
      payout = round((amount / winPool) * distributable, coin);
      status = 'won';
    }

    const wallet = await moveFunds(base44, bet.user_id, coin, { locked: -amount, available: payout });
    if (payout > 0) {
      await recordLedger(base44, {
        userId: bet.user_id,
        coin,
        amount: payout,
        kind: 'payout',
        description: `${distributed ? 'Prop won' : 'Prop refunded'} · ${market.question}`,
        balanceAfter: wallet.available,
        refId: market.id,
      });
    }
    results.push({ id: bet.id, status, payout });
  }

  if (results.length) await base44.asServiceRole.entities.PropBet.bulkUpdate(results);

  const patch = {
    status: distributed ? 'resolved' : 'void',
    resolved_by: resolvedBy || 'operator',
    resolved_at: new Date().toISOString(),
    note: note || '',
  };
  if (distributed) patch.result = result;

  return base44.asServiceRole.entities.PropMarket.update(market.id, patch);
}

// Stakes can never be stranded: any market still open when a match closes is refunded.
export async function voidOpenMarkets(base44, matchId, note) {
  const markets = await asRows(base44.asServiceRole.entities.PropMarket.filter({ match_id: matchId }));
  const open = markets.filter((m) => m.status === 'open' || m.status === 'locked');
  for (const market of open) {
    await resolveMarket(base44, market, 'void', note || 'Match closed — prop stakes refunded', 'settlement');
  }
  return open.length;
}