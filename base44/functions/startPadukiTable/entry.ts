import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser } from '../../shared/wallet.ts';
import { playersOf, ACTION_TIMEOUT_MS, firstActorSeat } from '../../shared/poker.ts';
import { dealDrawHands } from '../../shared/paduki.ts';

// Deal a Paduki hand. The creator starts the hand
// once 2-5 players are seated. The deck is shuffled server-side and
// each player is dealt 4 cards; the rest of the deck is stashed on a
// service-role-only PokerHand row for the draws. The first draw pass
// opens right away.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tableId = String(body.table_id || '').trim();
    if (!tableId) return Response.json({ error: 'table_id is required' }, { status: 400 });

    const table = await base44.asServiceRole.entities.PokerTable.get(tableId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e),
    );
    if (!table) return Response.json({ error: 'Table not found' }, { status: 404 });
    if (table.creator_id !== user.id) {
      return Response.json({ error: 'Only the table creator can deal the hand.' }, { status: 400 });
    }
    if (table.status !== 'lobby') {
      return Response.json({ error: 'This hand has already been dealt.' }, { status: 400 });
    }

    const players = playersOf(table);
    if (players.length < 2) {
      return Response.json({ error: 'Need at least 2 players seated to deal.' }, { status: 400 });
    }

    await dealDrawHands(base44, table, players);

    for (const p of players) {
      p.drawn = false;
      p.round_paid = 0;
      p.acted = false;
    }

    const firstSeat = firstActorSeat(players, Number(table.dealer_seat || 0));
    const updated = await base44.asServiceRole.entities.PokerTable.update(table.id, {
      status: 'in_play',
      phase: 'betting',
      reveal_round: 0,
      current_bet: 0,
      pot: 0,
      players_json: JSON.stringify(players),
      turn_user_id: firstSeat === null ? '' : players[firstSeat].user_id,
      turn_expires_at:
        firstSeat === null ? '' : new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString(),
      version: Number(table.version || 0) + 1,
    });

    return Response.json({ table: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
