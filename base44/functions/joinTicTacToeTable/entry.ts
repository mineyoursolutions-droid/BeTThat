import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { round, handleFor, requireUser, moveFunds, recordLedger } from '../../shared/wallet.ts';
import { playersOf, newPlayerState } from '../../shared/poker.ts';

// Take a seat at a Tic Tac Toe table (max 5 players). The buy-in is
// locked into escrow, like a match stake.
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
    if (table.game_slug !== 'tic-tac-toe') {
      return Response.json({ error: 'This is not a Tic Tac Toe table.' }, { status: 400 });
    }
    if (table.status !== 'lobby') {
      return Response.json({ error: 'This table is already playing.' }, { status: 400 });
    }

    const players = playersOf(table);
    if (players.some((p) => p.user_id === user.id)) {
      return Response.json({ error: 'You are already seated at this table.' }, { status: 400 });
    }
    if (players.length >= 5) {
      return Response.json({ error: 'This table is full — 5 players max.' }, { status: 400 });
    }

    const stake = round(Number(table.stake || 0), table.coin);
    let wallet;
    try {
      wallet = await moveFunds(base44, user.id, table.coin, { available: -stake, locked: stake });
    } catch (err) {
      return Response.json(
        { error: 'Not enough balance for the buy-in. Fund your wallet first.' },
        { status: 400 },
      );
    }

    const handle = handleFor(user);
    const seat = players.length;
    players.push(newPlayerState({ userId: user.id, handle, seat, stake }));
    const updated = await base44.asServiceRole.entities.PokerTable.update(table.id, {
      players_json: JSON.stringify(players),
      version: Number(table.version || 0) + 1,
    });

    await recordLedger(base44, {
      userId: user.id,
      coin: table.coin,
      amount: -stake,
      kind: 'stake',
      description: `Tic Tac Toe buy-in · ${table.title}`,
      balanceAfter: wallet.available,
      refId: table.id,
    });

    return Response.json({ table: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
