import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser } from '../../shared/wallet.ts';
import { playersOf, activePlayers } from '../../shared/poker.ts';
import {
  applyLowballAction,
  advanceTimeoutsLowball,
  settleLowball,
  getDeckRow,
  saveDeckRow,
  getHandRow,
} from '../../shared/lowball.ts';

// One endpoint for every in-hand move in Lowball: the draw (throw back
// up to five cards) and betting actions (check / bet / call / fold).
// The lowest ace-to-five hand wins the whole pot; ties split it.
// Body: { table_id, action, discards? }
// Expired turns are swept first, so a stalled player never freezes
// the table: a missed draw becomes a stand pat, a missed bet becomes
// a check if possible, otherwise a fold.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tableId = String(body.table_id || '').trim();
    const action = String(body.action || '').trim();
    const discards = Array.isArray(body.discards) ? body.discards : [];
    if (!tableId) return Response.json({ error: 'table_id is required' }, { status: 400 });

    let table = await base44.asServiceRole.entities.PokerTable.get(tableId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e),
    );
    if (!table) return Response.json({ error: 'Table not found' }, { status: 404 });
    if (table.status !== 'in_play') {
      return Response.json({ error: 'This hand is not in play.' }, { status: 400 });
    }

    const players = playersOf(table);
    const seat = players.findIndex((p) => p.user_id === user.id);
    if (seat < 0) return Response.json({ error: 'You are not seated at this table.' }, { status: 400 });

    // Sweep any expired turn first — the game may already have moved on.
    const timeoutChanged = advanceTimeoutsLowball(table, players);
    const timedOut = table._pendingOutcome || null;
    if (timedOut === 'last-standing' || timedOut === 'showdown') {
      const last = activePlayers(players)[0];
      const settled = await settleLowball(
        base44,
        table,
        players,
        timedOut,
        timedOut === 'last-standing' ? last?.user_id : undefined,
      );
      return Response.json({ table: settled.table, settled: true, note: settled.note });
    }

    // A draw needs the player's hand and the undealt deck.
    let handRow = null;
    let deckRow = null;
    if (action === 'draw') {
      handRow = await getHandRow(base44, table.id, user.id);
      deckRow = await getDeckRow(base44, table.id);
      if (!handRow || !deckRow) {
        return Response.json({ error: 'Your cards are not ready.' }, { status: 400 });
      }
    }

    const result = applyLowballAction(
      table,
      players,
      seat,
      action,
      discards,
      handRow ? handRow.cards : [],
      deckRow ? deckRow.cards : [],
    );
    if (result.error) {
      if (timeoutChanged) {
        await base44.asServiceRole.entities.PokerTable.update(table.id, {
          players_json: JSON.stringify(players),
          pot: table.pot,
          current_bet: table.current_bet,
          reveal_round: table.reveal_round,
          phase: table.phase,
          turn_user_id: table.turn_user_id,
          turn_expires_at: table.turn_expires_at,
          version: Number(table.version || 0) + 1,
        });
      }
      return Response.json({ error: result.error }, { status: 400 });
    }

    // Persist a draw: the player's new hand and the shortened deck.
    if (result.newHand && handRow) {
      await base44.asServiceRole.entities.PokerHand.update(handRow.id, {
        cards_json: JSON.stringify(result.newHand),
      });
    }
    if (result.newDeck && deckRow) {
      await saveDeckRow(base44, deckRow.id, result.newDeck);
    }

    if (result.outcome === 'last-standing' || result.outcome === 'showdown') {
      const last = activePlayers(players)[0];
      const settled = await settleLowball(
        base44,
        table,
        players,
        result.outcome,
        result.outcome === 'last-standing' ? last?.user_id : undefined,
      );
      return Response.json({ table: settled.table, settled: true, note: settled.note });
    }

    const updated = await base44.asServiceRole.entities.PokerTable.update(table.id, {
      players_json: JSON.stringify(players),
      pot: table.pot,
      current_bet: table.current_bet,
      reveal_round: table.reveal_round,
      phase: table.phase,
      turn_user_id: table.turn_user_id,
      turn_expires_at: table.turn_expires_at,
      version: Number(table.version || 0) + 1,
    });

    return Response.json({ table: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
