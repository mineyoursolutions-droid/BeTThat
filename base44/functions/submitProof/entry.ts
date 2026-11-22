import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, getMatch } from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '').trim();
    const fileUri = String(body.file_uri || '').trim();
    const kind = body.kind === 'video' ? 'video' : 'image';
    const note = String(body.note || '').trim().slice(0, 280);

    if (!matchId) return Response.json({ error: 'match_id is required' }, { status: 400 });
    if (!fileUri) return Response.json({ error: 'file_uri is required' }, { status: 400 });

    const match = await getMatch(base44, matchId);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

    let side;
    if (match.creator_id === user.id) side = 'creator';
    else if (match.challenger_id === user.id) side = 'challenger';
    else return Response.json({ error: 'Only a player in this match can submit evidence.' }, { status: 403 });

    if (['settled', 'cancelled'].includes(match.status)) {
      return Response.json({ error: 'This match is closed.' }, { status: 400 });
    }

    const at = new Date().toISOString();
    const updated = await base44.asServiceRole.entities.Match.update(match.id, {
      [`${side}_proof_uri`]: fileUri,
      [`${side}_proof_kind`]: kind,
      [`${side}_proof_note`]: note,
      [`${side}_proof_at`]: at,
    });

    return Response.json({ match: updated, side });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}