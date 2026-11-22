import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { COINS, round, handleFor, requireUser, moveFunds, recordLedger, getMatch } from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '').trim();
    const kind = body.kind === 'player' ? 'player' : 'spectator';
    const side = body.side === 'creator' ? 'creator' : 'challenger';

    if (!matchId) return Response.json({ error: 'match_id is required' }, { status: 400 });

    const match = await getMatch(base44, matchId);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });
    if (match.status === 'settled' || match.status === 'cancelled') {
      return Response.json({ error: 'This match is closed.' }, { status: 400 });
    }

    let coin;
    let amount;

    if (kind === 'player') {
      if (match.creator_id === user.id) {
        return Response.json({ error: 'You cannot accept your own challenge.' }, { status: 400 });
      }
      if (match.challenger_id) {
        return Response.json({ error: 'This challenge has already been accepted.' }, { status: 400 });
      }
      if (match.status !== 'open') {
        return Response.json({ error: 'This challenge is no longer open.' }, { status: 400 });
      }
      if (side !== 'challenger') {
        return Response.json({ error: 'A challenger takes the challenger side.' }, { status: 400 });
      }
      coin = match.coin;
      amount = round(Number(match.stake), match.coin);
    } else {
      if (!['open', 'matched', 'in_play'].includes(match.status)) {
        return Response.json({ error: 'Spectator betting is closed on this match.' }, { status: 400 });
      }
      coin = String(body.coin || '').toUpperCase();
      if (!COINS.includes(coin)) return Response.json({ error: 'Unsupported coin.' }, { status: 400 });
      if (coin !== match.coin) {
        return Response.json(
          { error: `This match settles in ${match.coin}. Switch your stake to ${match.coin}.` },
          { status: 400 },
        );
      }
      amount = round(Number(body.amount || 0), coin);
      if (!(amount > 0)) return Response.json({ error: 'Enter an amount to back.' }, { status: 400 });
    }

    let wallet;
    try {
      wallet = await moveFunds(base44, user.id, coin, { available: -amount, locked: amount });
    } catch (err) {
      return Response.json({ error: 'Not enough available balance for that wager.' }, { status: 400 });
    }

    const handle = handleFor(user);
    const wager = await base44.asServiceRole.entities.Wager.create({
      match_id: match.id,
      match_title: match.title,
      game_slug: match.game_slug,
      kind,
      side,
      user_id: user.id,
      user_handle: handle,
      coin,
      amount,
      status: 'locked',
      payout: 0,
    });

    const patch = {};
    if (kind === 'player') {
      patch.challenger_id = user.id;
      patch.challenger_handle = handle;
      patch.status = 'matched';
    } else if (side === 'creator') {
      patch.spectator_pool_creator = round(Number(match.spectator_pool_creator || 0) + amount, coin);
      patch.spectator_count = Number(match.spectator_count || 0) + 1;
    } else {
      patch.spectator_pool_challenger = round(Number(match.spectator_pool_challenger || 0) + amount, coin);
      patch.spectator_count = Number(match.spectator_count || 0) + 1;
    }
    const updated = await base44.asServiceRole.entities.Match.update(match.id, patch);

    await recordLedger(base44, {
      userId: user.id,
      coin,
      amount: -amount,
      kind: 'stake',
      description:
        kind === 'player' ? `Accepted challenge · ${match.title}` : `Spectator wager · ${match.title}`,
      balanceAfter: wallet.available,
      refId: match.id,
    });

    return Response.json({ wager, match: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}