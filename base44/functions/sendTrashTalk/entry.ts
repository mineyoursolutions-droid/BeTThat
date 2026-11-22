import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { handleFor, requireUser, getMatch } from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '').trim();
    const text = String(body.text || '').trim().slice(0, 400);

    if (!matchId) return Response.json({ error: 'match_id is required' }, { status: 400 });
    if (!text) return Response.json({ error: 'Write something first.' }, { status: 400 });

    const match = await getMatch(base44, matchId);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

    let side = 'spectator';
    if (match.creator_id === user.id) side = 'creator';
    else if (match.challenger_id === user.id) side = 'challenger';

    const post = await base44.asServiceRole.entities.TrashTalk.create({
      match_id: match.id,
      user_id: user.id,
      user_handle: handleFor(user),
      side,
      body: text,
    });

    return Response.json({ post });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}