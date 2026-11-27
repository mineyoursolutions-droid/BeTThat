import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolvePokerIdentity, isPlayMoneyTable } from '../../shared/guest.ts';
import { playersOf } from '../../shared/poker.ts';
import { dealLowballHand } from '../../shared/lowball.ts';
import { seatBots } from '../../shared/bots.ts';

// Deal a Lowball hand (ace-to-five, 5 cards each). The creator starts
// the hand once 2-5 players are seated. The deck is shuffled
// server-side and each player is dealt 5 cards; the rest of the deck
// is stashed on a service-role-only PokerHand row for the draw. The
// single draw pass opens right away.
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
    // Play-money tables: a lone human gets bot opponents so the hand
    // can start. Real-money tables keep the human-only 2+ player rule.
    if (isPlayMoneyTable(table)) seatBots(table, players);
    if (players.length < 2) {
      return Response.json({ error: 'Need at least 2 players seated to deal.' }, { status: 400 });
    }

    const updated = await dealLowballHand(base44, table, players);

    return Response.json({ table: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
