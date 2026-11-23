import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { COINS, round, handleFor, requireUser, moveFunds, recordLedger } from '../../shared/wallet.ts';
import { newPlayerState } from '../../shared/poker.ts';

// Create a Paduki (Chang Gang poker) table. The creator's buy-in
// is locked into escrow up front, exactly like a match stake; betting
// during the hand moves chips inside the table, and the pot settles
// with the usual 5% house fee.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = String(body.title || 'Paduki table').trim();
    const coin = String(body.coin || '').toUpperCase();
    const stake = Number(body.stake || 0);

    if (!COINS.includes(coin)) {
      return Response.json({ error: 'Unsupported coin.' }, { status: 400 });
    }
    if (!(stake > 0)) {
      return Response.json({ error: 'Buy-in must be greater than zero.' }, { status: 400 });
    }

    let wallet;
    try {
      wallet = await moveFunds(base44, user.id, coin, { available: -stake, locked: stake });
    } catch (err) {
      return Response.json(
        { error: 'Not enough balance for that buy-in. Fund your wallet first.' },
        { status: 400 },
      );
    }

    const handle = handleFor(user);
    const buyIn = round(stake, coin);
    const table = await base44.asServiceRole.entities.PokerTable.create({
      title,
      game_slug: 'paduki',
      coin,
      stake: buyIn,
      bet_unit: round(buyIn / 10, coin),
      status: 'lobby',
      phase: 'betting',
      creator_id: user.id,
      creator_handle: handle,
      pot: 0,
      current_bet: 0,
      reveal_round: 0,
      dealer_seat: 0,
      turn_user_id: '',
      turn_expires_at: '',
      players_json: JSON.stringify([newPlayerState({ userId: user.id, handle, seat: 0, stake: buyIn })]),
      result_json: '',
      settle_note: '',
      version: 1,
    });

    await recordLedger(base44, {
      userId: user.id,
      coin,
      amount: -stake,
      kind: 'stake',
      description: `Paduki buy-in · ${title}`,
      balanceAfter: wallet.available,
      refId: table.id,
    });

    return Response.json({ table });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
