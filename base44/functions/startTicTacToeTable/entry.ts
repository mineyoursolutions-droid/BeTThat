import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolvePokerIdentity } from '../../shared/guest.ts';
import { playersOf, newDeck, shuffleDeck, ACTION_TIMEOUT_MS, firstActorSeat } from '../../shared/poker.ts';

// Deal a Tic Tac Toe hand. The creator starts the hand once 2-5
// players are seated. The deck is shuffled server-side and each player
// is dealt 9 cards in a 3x3 grid (private, stored on the PokerHand row
// only they can read). One betting round opens right away.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // Signed-in account or guest: guests only ever play the
    // play-money tables (see the play-money guards below);
    // real-money play still requires the signed-in account.
    const me = await resolvePokerIdentity(base44, body);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const tableId = String(body.table_id || '').trim();
    if (!tableId) return Response.json({ error: 'table_id is required' }, { status: 400 });

    const table = await base44.asServiceRole.entities.PokerTable.get(tableId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e),
    );
    if (!table) return Response.json({ error: 'Table not found' }, { status: 404 });
    if (table.creator_id !== me.id) {
      return Response.json({ error: 'Only the table creator can deal the hand.' }, { status: 400 });
    }
    if (table.status !== 'lobby') {
      return Response.json({ error: 'This hand has already been dealt.' }, { status: 400 });
    }

    const players = playersOf(table);
    if (players.length < 2) {
      return Response.json({ error: 'Need at least 2 players seated to deal.' }, { status: 400 });
    }

    const deck = shuffleDeck(newDeck());
    const handsByUser = {};
    for (let i = 0; i < players.length; i++) {
      const hand = deck.slice(i * 9, i * 9 + 9);
      handsByUser[players[i].user_id] = hand;
      await base44.asServiceRole.entities.PokerHand.create({
        table_id: table.id,
        user_id: players[i].user_id,
        cards_json: JSON.stringify(hand),
      });
    }

    for (const p of players) {
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
