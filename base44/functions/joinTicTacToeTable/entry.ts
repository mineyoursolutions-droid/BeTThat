import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { round, moveFunds, recordLedger } from '../../shared/wallet.ts';
import { resolvePokerIdentity, isPlayMoneyTable } from '../../shared/guest.ts';
import { playersOf, newPlayerState } from '../../shared/poker.ts';
import { displaceBotForHuman } from '../../shared/bots.ts';

// Take a seat at a Tic Tac Toe table (max 5 players). The buy-in is
// locked into escrow, like a match stake.
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
    if (table.game_slug !== 'tic-tac-toe') {
      return Response.json({ error: 'This is not a Tic Tac Toe table.' }, { status: 400 });
    }
    if (table.status !== 'lobby') {
      return Response.json({ error: 'This table is already playing.' }, { status: 400 });
    }

    const players = playersOf(table);
    if (players.some((p) => p.user_id === me.id)) {
      return Response.json({ error: 'You are already seated at this table.' }, { status: 400 });
    }
    // A joining human takes a bot's seat on a play-money table, so a
    // full table with bots still has room for a real player.
    if (isPlayMoneyTable(table)) displaceBotForHuman(players);
    if (players.length >= 5) {
      return Response.json({ error: 'This table is full — 5 players max.' }, { status: 400 });
    }

    const stake = round(Number(table.stake || 0), table.coin);
    // Play-money tables seat guests and signed-in players alike
    // with virtual chips — no wallet, no escrow. Real-money
    // tables still lock the buy-in in escrow, and guests cannot
    // sit at them.
    const playMoney = isPlayMoneyTable(table);
    let wallet = null;
    if (!playMoney) {
      if (me.isGuest) {
        return Response.json(
          { error: 'This table is real money — sign in to take a seat.' },
          { status: 403 },
        );
      }
      try {
        wallet = await moveFunds(base44, me.id, table.coin, { available: -stake, locked: stake });
      } catch (err) {
        return Response.json(
          { error: 'Not enough balance for the buy-in. Fund your wallet first.' },
          { status: 400 },
        );
      }
    }

    const seat = players.length;
    players.push(newPlayerState({ userId: me.id, handle: me.handle, seat, stake }));
    const updated = await base44.asServiceRole.entities.PokerTable.update(table.id, {
      players_json: JSON.stringify(players),
      version: Number(table.version || 0) + 1,
    });

    if (!playMoney) {
      await recordLedger(base44, {
        userId: me.id,
        coin: table.coin,
        amount: -stake,
        kind: 'stake',
        description: `Tic Tac Toe buy-in · ${table.title}`,
        balanceAfter: wallet.available,
        refId: table.id,
      });
    }

    return Response.json({ table: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
