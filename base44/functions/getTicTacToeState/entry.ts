import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser } from '../../shared/wallet.ts';
import {
  advanceTimeoutsTTT,
  settleTicTacToe,
  bestHighLine,
  bestLowLine,
} from '../../shared/ticTacToe.ts';
import { playersOf, activePlayers, getTableHands } from '../../shared/poker.ts';

// The table's live read: returns the public table state plus the
// caller's own 9 cards (the grid is private — it lives on the
// PokerHand row only its owner can read). This is also the poll
// endpoint: an expired turn is swept here, so a stalled player cannot
// freeze the table. The sweep writes only when the table has not
// changed since this call read it (optimistic version check), so a
// concurrent player action is never clobbered.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tableId = String(body.table_id || '').trim();
    if (!tableId) return Response.json({ error: 'table_id is required' }, { status: 400 });

    let table = await base44.asServiceRole.entities.PokerTable.get(tableId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e),
    );
    if (!table) return Response.json({ error: 'Table not found' }, { status: 404 });

    let players = playersOf(table);
    const mySeat = players.findIndex((p) => p.user_id === user.id);

    if (table.status === 'in_play') {
      const handsByUser = await getTableHands(base44, table.id);
      const versionBefore = Number(table.version || 0);
      const changed = advanceTimeoutsTTT(table, players);
      const pendingOutcome = table._pendingOutcome || null;
      if (changed) {
        // Re-read: only write the sweep if nobody acted in between.
        const fresh = await base44.asServiceRole.entities.PokerTable.get(table.id).catch(() => null);
        if (fresh && Number(fresh.version || 0) === versionBefore) {
          if (pendingOutcome === 'last-standing' || pendingOutcome === 'showdown') {
            const last = activePlayers(players)[0];
            const settled = await settleTicTacToe(
              base44,
              table,
              players,
              pendingOutcome,
              pendingOutcome === 'last-standing' ? last?.user_id : undefined,
            );
            table = settled.table;
          } else {
            table = await base44.asServiceRole.entities.PokerTable.update(table.id, {
              players_json: JSON.stringify(players),
              pot: table.pot,
              current_bet: table.current_bet,
              phase: table.phase,
              turn_user_id: table.turn_user_id,
              turn_expires_at: table.turn_expires_at,
              version: versionBefore + 1,
            });
          }
        } else if (fresh) {
          // Someone acted while this call was sweeping — serve their
          // newer state instead of the stale in-memory one.
          table = fresh;
        }
      }
      // Always answer from the table that is actually stored.
      players = playersOf(table);
    }

    const handsByUser = await getTableHands(base44, table.id);
    const myHand = mySeat >= 0 ? handsByUser[user.id] || null : null;
    // Your best 3-card high and low lines from your grid, right now —
    // computed server-side so the table can show them live.
    const myBest =
      myHand && myHand.length === 9
        ? { high: bestHighLine(myHand), low: bestLowLine(myHand) }
        : null;

    return Response.json({
      table,
      players,
      my_hand: myHand,
      my_best: myBest,
      my_seat: mySeat,
      is_player: mySeat >= 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
