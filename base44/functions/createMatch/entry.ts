import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { COINS, round, handleFor, requireUser, moveFunds, recordLedger } from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    const gameSlug = String(body.game_slug || '').trim();
    const gameName = String(body.game_name || '').trim();
    const coin = String(body.coin || '').toUpperCase();
    const stake = Number(body.stake || 0);

    if (!title || !gameSlug) {
      return Response.json({ error: 'Pick a game and give the match a title.' }, { status: 400 });
    }
    if (!COINS.includes(coin)) {
      return Response.json({ error: 'Unsupported coin.' }, { status: 400 });
    }
    if (!(stake > 0)) {
      return Response.json({ error: 'Stake must be greater than zero.' }, { status: 400 });
    }

    let wallet;
    try {
      wallet = await moveFunds(base44, user.id, coin, { available: -stake, locked: stake });
    } catch (err) {
      return Response.json(
        { error: 'Not enough balance for that stake. Fund your wallet first.' },
        { status: 400 },
      );
    }

    const handle = handleFor(user);
    const match = await base44.asServiceRole.entities.Match.create({
      title,
      game_slug: gameSlug,
      game_name: gameName || gameSlug,
      ruleset: String(body.ruleset || '').trim(),
      platform: String(body.platform || 'Cross-play'),
      region: String(body.region || 'Global'),
      coin,
      stake: round(stake, coin),
      status: 'open',
      creator_id: user.id,
      creator_handle: handle,
      challenger_id: '',
      challenger_handle: '',
      starts_at: String(body.starts_at || ''),
      spectator_pool_creator: 0,
      spectator_pool_challenger: 0,
      spectator_count: 0,
    });

    await base44.asServiceRole.entities.Wager.create({
      match_id: match.id,
      match_title: title,
      game_slug: gameSlug,
      kind: 'player',
      side: 'creator',
      user_id: user.id,
      user_handle: handle,
      coin,
      amount: round(stake, coin),
      status: 'locked',
      payout: 0,
    });

    await recordLedger(base44, {
      userId: user.id,
      coin,
      amount: -stake,
      kind: 'stake',
      description: `Stake escrowed · ${title}`,
      balanceAfter: wallet.available,
      refId: match.id,
    });

    return Response.json({ match });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}