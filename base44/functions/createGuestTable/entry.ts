import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  resolvePokerIdentity,
  createGuestTableRecord,
  GUEST_GAME_NAMES,
} from '../../shared/guest.ts';

// Open a private play-money table for one of the six Chain Gang Poker
// games. Anyone can host — a signed-in account or a guest with no
// account at all. The table is invite-only (link + 6-character code),
// never listed in a public lobby, and plays with virtual chips only:
// no buy-in is taken, no escrow, no house fee.
// Body: { game_slug, title?, buy_in?, guest_id?, guest_name? }
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const me = await resolvePokerIdentity(base44, body);
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const gameSlug = String(body.game_slug || '').trim();
    const title = String(body.title || '').trim();
    const buyIn = Number(body.buy_in || 0);

    const table = await createGuestTableRecord(base44, { gameSlug, title, buyIn, me });
    return Response.json({
      table,
      join_code: table.join_code,
      game_name: GUEST_GAME_NAMES[gameSlug],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
