import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { handleFor, requireUser, getMatch } from '../../shared/wallet.ts';

const CLOSED = ['settled', 'cancelled'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '').trim();
    const text = String(body.text || '').trim().slice(0, 800);
    const fileUri = String(body.file_uri || '').trim();
    const fileKind = body.file_kind === 'video' ? 'video' : body.file_kind === 'image' ? 'image' : '';

    if (!matchId) return Response.json({ error: 'match_id is required' }, { status: 400 });
    if (!text && !fileUri) return Response.json({ error: 'Write a message or attach a file.' }, { status: 400 });

    const match = await getMatch(base44, matchId);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });

    let side;
    if (match.creator_id === user.id) side = 'creator';
    else if (match.challenger_id === user.id) side = 'challenger';
    else return Response.json({ error: 'Only the two players can post in this thread.' }, { status: 403 });

    if (CLOSED.includes(match.status)) {
      return Response.json({ error: 'This match is closed — the thread is read-only.' }, { status: 400 });
    }

    const members = [match.creator_id, match.challenger_id].filter(Boolean);

    const message = await base44.asServiceRole.entities.MatchMessage.create({
      match_id: match.id,
      members,
      sender_id: user.id,
      sender_handle: handleFor(user),
      side,
      body: text,
      file_uri: fileUri,
      file_kind: fileKind,
    });

    return Response.json({ message });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}