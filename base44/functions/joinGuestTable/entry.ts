import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { resolvePokerIdentity, joinGuestTableRecord } from '../../shared/guest.ts';

// Take a seat at a private play-money table — by table id (the invite
// link) or by 6-character join code (typed into the hub or a lobby).
// Anyone can join: a signed-in account or a guest with no account.
// The seat costs virtual chips only; nothing is taken from a wallet.
// Real-money tables are refused here — they are joined from their own
// lobby through the per-game join function.
// Body: { table_id?, join_code?, guest_id?, guest_name? }
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const me = await resolvePokerIdentity(base44, body);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const table = await joinGuestTableRecord(base44, {
      tableId: body.table_id,
      joinCode: body.join_code,
      me,
    });
    return Response.json({ table });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
