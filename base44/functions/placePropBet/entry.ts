import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { round, handleFor, requireUser, moveFunds, recordLedger, getMatch } from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const marketId = String(body.market_id || '').trim();
    const side = body.side === 'no' ? 'no' : 'yes';

    if (!marketId) return Response.json({ error: 'market_id is required' }, { status: 400 });

    const market = await base44.asServiceRole.entities.PropMarket.get(marketId).catch((e) => {
      if (e.status === 404) return null;
      throw e;
    });
    if (!market) return Response.json({ error: 'Market not found' }, { status: 404 });
    if (market.status !== 'open') return Response.json({ error: 'This market is closed.' }, { status: 400 });

    const match = await getMatch(base44, market.match_id);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });
    if (!['open', 'matched', 'in_play', 'awaiting_result'].includes(match.status)) {
      return Response.json({ error: 'This match is closed.' }, { status: 400 });
    }
    if (match.creator_id === user.id || match.challenger_id === user.id) {
      return Response.json({ error: 'Players cannot bet on their own match.' }, { status: 400 });
    }

    const coin = market.coin;
    const amount = round(Number(body.amount || 0), coin);
    if (!(amount > 0)) return Response.json({ error: 'Enter an amount to back.' }, { status: 400 });

    let wallet;
    try {
      wallet = await moveFunds(base44, user.id, coin, { available: -amount, locked: amount });
    } catch (err) {
      return Response.json({ error: 'Not enough available balance for that prop bet.' }, { status: 400 });
    }

    const bet = await base44.asServiceRole.entities.PropBet.create({
      market_id: market.id,
      match_id: market.match_id,
      question: market.question,
      user_id: user.id,
      user_handle: handleFor(user),
      coin,
      side,
      amount,
      status: 'locked',
      payout: 0,
    });

    const patch =
      side === 'yes'
        ? {
            yes_pool: round(Number(market.yes_pool || 0) + amount, coin),
            bettor_count: Number(market.bettor_count || 0) + 1,
          }
        : {
            no_pool: round(Number(market.no_pool || 0) + amount, coin),
            bettor_count: Number(market.bettor_count || 0) + 1,
          };

    const updated = await base44.asServiceRole.entities.PropMarket.update(market.id, patch);

    await recordLedger(base44, {
      userId: user.id,
      coin,
      amount: -amount,
      kind: 'stake',
      description: `Prop bet · ${market.question}`,
      balanceAfter: wallet.available,
      refId: market.id,
    });

    return Response.json({ bet, market: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}