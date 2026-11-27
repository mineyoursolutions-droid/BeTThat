import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolvePokerIdentity, isPlayMoneyTable } from '../../shared/guest.ts';
import {
  applyTicTacToeAction,
  advanceTimeoutsTTT,
  settleTicTacToe,
  driveTicTacToeBotTurns,
} from '../../shared/ticTacToe.ts';
import { playersOf, activePlayers, getTableHands } from '../../shared/poker.ts';

// One endpoint for every in-hand move: betting actions (check / bet /
// call / fold) and declare actions (high / low / swing / speak).
// Body: { table_id, action, declare? }
// Expired turns are swept first, so a stalled player never freezes
// the table: a missed bet becomes a check if possible, otherwise a
// fold; a missed declare becomes "cards speak".
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
    const action = String(body.action || '').trim();
    const declare = String(body.declare || '').trim();
    if (!tableId) return Response.json({ error: 'table_id is required' }, { status: 400 });

    let table = await base44.asServiceRole.entities.PokerTable.get(tableId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e),
    );
    if (!table) return Response.json({ error: 'Table not found' }, { status: 404 });
    const playMoney = isPlayMoneyTable(table);
    if (table.status !== 'in_play') {
      return Response.json({ error: 'This hand is not in play.' }, { status: 400 });
    }

    const players = playersOf(table);
    const seat = players.findIndex((p) => p.user_id === me.id);
    if (seat < 0) return Response.json({ error: 'You are not seated at this table.' }, { status: 400 });

    // Sweep any expired turn first — the game may already have moved on.
    const timeoutChanged = advanceTimeoutsTTT(table, players);
    const timedOut = table._pendingOutcome || null;
    if (timedOut === 'last-standing' || timedOut === 'showdown') {
      const last = activePlayers(players)[0];
      const settled = await settleTicTacToe(
        base44,
        table,
        players,
        timedOut,
        timedOut === 'last-standing' ? last?.user_id : undefined,
        { playMoney },
      );
      return Response.json({ table: settled.table, settled: true, note: settled.note });
    }

    const result = applyTicTacToeAction(table, players, seat, action, declare);
    if (result.error) {
      // Persist the timeout sweep even when this action is rejected, so
      // the table never sits on an expired turn.
      if (timeoutChanged) {
        await base44.asServiceRole.entities.PokerTable.update(table.id, {
          players_json: JSON.stringify(players),
          pot: table.pot,
          current_bet: table.current_bet,
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
      const settled = await settleTicTacToe(
        base44,
        table,
        players,
        result.outcome,
        result.outcome === 'last-standing' ? last?.user_id : undefined,
        { playMoney },
      );
      return Response.json({ table: settled.table, settled: true, note: settled.note });
    }

    // Bots act on their own turn so a hand with bots keeps moving
    // without waiting for a human to open the table again.
    if (playMoney) {
      const handsByUser = await getTableHands(base44, table.id);
      const botOutcome = await driveTicTacToeBotTurns(base44, table, players, handsByUser);
      if (botOutcome === 'last-standing' || botOutcome === 'showdown') {
        const last = activePlayers(players)[0];
        const settled = await settleTicTacToe(
          base44,
          table,
          players,
          botOutcome,
          botOutcome === 'last-standing' ? last?.user_id : undefined,
          { playMoney },
        );
        return Response.json({ table: settled.table, settled: true, note: settled.note });
      }
    }

    const updated = await base44.asServiceRole.entities.PokerTable.update(table.id, {
      players_json: JSON.stringify(players),
      pot: table.pot,
      current_bet: table.current_bet,
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
