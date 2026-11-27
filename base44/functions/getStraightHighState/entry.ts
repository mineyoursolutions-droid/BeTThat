import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolvePokerIdentity, isPlayMoneyTable } from '../../shared/guest.ts';
import { playersOf, activePlayers, getTableHands } from '../../shared/poker.ts';
import {
  advanceTimeoutsDraw,
  settleDrawGame,
  evaluateHigh4,
  evaluateLow4,
  dealDrawGameHand,
  driveDrawGameBotTurns,
} from '../../shared/paduki.ts';
import {
  seatBots,
  removeBotsWhenNoHumans,
  botPlayers,
  humanPlayers,
  botGraceExpired,
} from '../../shared/bots.ts';

// The table's live read: returns the public table state plus the
// caller's own 4 cards (they live on the PokerHand row only its owner
// can read — the undealt deck is never sent). This is also the poll
// endpoint: an expired turn is swept here, so a stalled player cannot
// freeze the table. The sweep writes only when the table has not
// changed since this call read it (optimistic version check), so a
// concurrent player action is never clobbered.
const OPTS = { declare: false };
const SETTLE_OPTS = { highOnly: true, gameLabel: 'Straight High' };

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

    let table = await base44.asServiceRole.entities.PokerTable.get(tableId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e),
    );
    if (!table) return Response.json({ error: 'Table not found' }, { status: 404 });
    const playMoney = isPlayMoneyTable(table);

    let players = playersOf(table);

    // Play-money lobby maintenance: bots fill a lone human's table,
    // leave when the last human leaves, and deal on their own once
    // the grace period has passed — so a player who pulls up alone
    // sees cards without pressing anything.
    if (
      table.status === 'lobby' &&
      playMoney &&
      (botPlayers(players).length > 0 || humanPlayers(players).length === 1)
    ) {
      const versionBefore = Number(table.version || 0);
      const botsRemoved = removeBotsWhenNoHumans(players);
      const botsAdded = seatBots(table, players);
      const fresh = await base44.asServiceRole.entities.PokerTable.get(table.id).catch(() => null);
      if (fresh && Number(fresh.version || 0) === versionBefore) {
        if (botsAdded.length > 0 || botsRemoved.length > 0) {
          table = await base44.asServiceRole.entities.PokerTable.update(table.id, {
            players_json: JSON.stringify(players),
            version: versionBefore + 1,
          });
          players = playersOf(table);
        }
        // Auto-deal once bots have sat through the grace period with
        // exactly one human at the table.
        if (
          humanPlayers(players).length === 1 &&
          botPlayers(players).length > 0 &&
          botGraceExpired(table)
        ) {
          table = await dealDrawGameHand(base44, table, players);
          players = playersOf(table);
        }
      } else if (fresh) {
        // Someone changed the table while this call was maintaining
        // it — serve their newer state instead.
        table = fresh;
        players = playersOf(table);
      }
    }

    const mySeat = players.findIndex((p) => p.user_id === me.id);

    if (table.status === 'in_play') {
      const versionBefore = Number(table.version || 0);
      const changed = advanceTimeoutsDraw(table, players, OPTS);
      const pendingOutcome = table._pendingOutcome || null;
      if (changed) {
        // Re-read: only write the sweep if nobody acted in between.
        const fresh = await base44.asServiceRole.entities.PokerTable.get(table.id).catch(() => null);
        if (fresh && Number(fresh.version || 0) === versionBefore) {
          if (pendingOutcome === 'last-standing' || pendingOutcome === 'showdown') {
            const last = activePlayers(players)[0];
            const settled = await settleDrawGame(
              base44,
              table,
              players,
              pendingOutcome,
              pendingOutcome === 'last-standing' ? last?.user_id : undefined,
              { ...SETTLE_OPTS, playMoney },
            );
            table = settled.table;
          } else {
            table = await base44.asServiceRole.entities.PokerTable.update(table.id, {
              players_json: JSON.stringify(players),
              pot: table.pot,
              current_bet: table.current_bet,
              reveal_round: table.reveal_round,
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
      // Re-read the stored state before driving bots, so a bot never
      // acts on a stale table.
      players = playersOf(table);
      // Bots act on their own turn so a hand with bots keeps moving
      // without waiting for a human to open the table again. The bot
      // driver reads each bot's hand and the deck from their rows.
      if (playMoney && table.status === 'in_play') {
        const stateBefore = JSON.stringify([
          table.turn_user_id,
          table.turn_expires_at,
          table.phase,
          table.current_bet,
          table.reveal_round,
          table.pot,
          players,
        ]);
        const botOutcome = await driveDrawGameBotTurns(base44, table, players, {}, OPTS);
        if (botOutcome === 'last-standing' || botOutcome === 'showdown') {
          const last = activePlayers(players)[0];
          const settled = await settleDrawGame(
            base44,
            table,
            players,
            botOutcome,
            botOutcome === 'last-standing' ? last?.user_id : undefined,
            { ...SETTLE_OPTS, playMoney },
          );
          table = settled.table;
        } else {
          const stateAfter = JSON.stringify([
            table.turn_user_id,
            table.turn_expires_at,
            table.phase,
            table.current_bet,
            table.reveal_round,
            table.pot,
            players,
          ]);
          if (stateAfter !== stateBefore) {
            // Only write when the bots actually moved, version-checked
            // like the sweep, so a concurrent player action is never
            // clobbered.
            const versionNow = Number(table.version || 0);
            const fresh = await base44.asServiceRole.entities.PokerTable.get(table.id).catch(() => null);
            if (fresh && Number(fresh.version || 0) === versionNow) {
              table = await base44.asServiceRole.entities.PokerTable.update(table.id, {
                players_json: JSON.stringify(players),
                pot: table.pot,
                current_bet: table.current_bet,
                reveal_round: table.reveal_round,
                phase: table.phase,
                turn_user_id: table.turn_user_id,
                turn_expires_at: table.turn_expires_at,
                version: versionNow + 1,
              });
            } else if (fresh) {
              table = fresh;
            }
          }
        }
      }
      // Always answer from the table that is actually stored.
      players = playersOf(table);
    }

    const handsByUser = await getTableHands(base44, table.id);
    const myHand = mySeat >= 0 ? handsByUser[me.id] || null : null;
    // Your hand evaluated right now — computed server-side so the
    // table can show it live. (The low line is shown for reference;
    // Straight High is high hand only.)
    const myBest =
      myHand && myHand.length === 4
        ? { high: evaluateHigh4(myHand), low: evaluateLow4(myHand) }
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
