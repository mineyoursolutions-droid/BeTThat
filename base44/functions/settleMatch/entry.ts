import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, getMatch } from '../../shared/wallet.ts';
import { settlePot, refundPool } from '../../shared/settle.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '').trim();
    const action = body.action === 'cancel' ? 'cancel' : 'settle';
    const winner = body.winner === 'challenger' ? 'challenger' : 'creator';
    const note = String(body.note || '').trim();

    if (!matchId) return Response.json({ error: 'match_id is required' }, { status: 400 });

    const match = await getMatch(base44, matchId);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });
    if (match.status === 'settled' || match.status === 'cancelled') {
      return Response.json({ error: 'This match is already closed.' }, { status: 400 });
    }

    if (action === 'cancel') {
      return Response.json(await refundPool(base44, match, note));
    }

    return Response.json(await settlePot(base44, match, winner, note));
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}