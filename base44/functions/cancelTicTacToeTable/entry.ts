import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, moveFunds, recordLedger } from '../../shared/wallet.ts';
import { playersOf } from '../../shared/poker.ts';

// Cancel a Tic Tac Toe table while it is still in the lobby — every
// seated player's buy-in is refunded in full. A hand already in play
// cannot be cancelled; it plays out or settles.
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
      return Response.json({ error: 'Only the table creator can cancel it.' }, { status: 400 });
    }
    if (table.status !== 'lobby') {
      return Response.json({ error: 'A hand already in play cannot be cancelled.' }, { status: 400 });
    }

    const players = playersOf(table);
    const stake = Number(table.stake || 0);
    for (const p of players) {
      const wallet = await moveFunds(base44, p.user_id, table.coin, { locked: -stake, available: stake });
      await recordLedger(base44, {
        userId: p.user_id,
        coin: table.coin,
        amount: stake,
        kind: 'refund',
        description: `Tic Tac Toe table cancelled · ${table.title}`,
        balanceAfter: wallet.available,
        refId: table.id,
      });
    }

    const updated = await base44.asServiceRole.entities.PokerTable.update(table.id, {
      status: 'cancelled',
      settle_note: 'Table cancelled — every buy-in refunded',
      version: Number(table.version || 0) + 1,
    });

    return Response.json({ table: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
