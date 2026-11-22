import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, getMatch } from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '').trim();
    const question = String(body.question || '').trim();

    if (!matchId) return Response.json({ error: 'Pick a match for this market.' }, { status: 400 });
    if (question.length < 6) {
      return Response.json({ error: 'Write the prop as a yes/no question (6+ characters).' }, { status: 400 });
    }
    if (question.length > 160) {
      return Response.json({ error: 'Keep the question under 160 characters.' }, { status: 400 });
    }

    const match = await getMatch(base44, matchId);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });
    if (match.status === 'settled' || match.status === 'cancelled') {
      return Response.json({ error: 'This match is already closed.' }, { status: 400 });
    }

    const market = await base44.asServiceRole.entities.PropMarket.create({
      match_id: match.id,
      match_title: match.title,
      game_slug: match.game_slug,
      question,
      coin: match.coin,
      status: 'open',
      yes_pool: 0,
      no_pool: 0,
      bettor_count: 0,
    });

    return Response.json({ market });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}