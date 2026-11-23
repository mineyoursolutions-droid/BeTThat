import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser } from '../../shared/wallet.ts';
import { playersOf, activePlayers } from '../../shared/poker.ts';
import {
  applyDeadSevenAction,
  advanceTimeoutsDeadSeven,
  settleDeadSeven,
} from '../../shared/deadSeven.ts';

// One endpoint for every in-hand move in Dead Seven: the single
// betting round (check / bet / call / fold). After the round closes
// the hand goes straight to showdown — no draws, no declare, the
// cards speak both ways and the pot splits high/low.
// Body: { table_id, action }
// Expired turns are swept first, so a stalled player never freezes
// the table: a missed bet becomes a check if possible, otherwise a
// fold.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tableId = String(body.table_id || '').trim();
    const action = String(body.action || '').trim();
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
    const timeoutChanged = advanceTimeoutsDeadSeven(table, players);
    const timedOut = table._pendingOutcome || null;
    if (timedOut === 'last-standing' || timedOut === 'showdown') {
      const last = activePlayers(players)[0];
      const settled = await settleDeadSeven(
        base44,
        table,
        players,
        timedOut,
        timedOut === 'last-standing' ? last?.user_id : undefined,
      );
      return Response.json({ table: settled.table, settled: true, note: settled.note });
    }

    const result = applyDeadSevenAction(table, players, seat, action);
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

    if (result.outcome === 'last-standing' || result.outcome === 'showdown') {
      const last = activePlayers(players)[0];
      const settled = await settleDeadSeven(
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
