import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { handleFor, requireUser, getMatch } from '../../shared/wallet.ts';
import { settlePot } from '../../shared/settle.ts';

const ELIGIBLE = ['matched', 'in_play', 'awaiting_result'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '').trim();
    const action = ['confirm', 'dispute'].includes(body.action) ? body.action : 'report';
    const winner = body.winner === 'challenger' ? 'challenger' : 'creator';

    if (!matchId) return Response.json({ error: 'match_id is required' }, { status: 400 });

    const match = await getMatch(base44, matchId);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });
    if (!ELIGIBLE.includes(match.status)) {
      return Response.json({ error: 'This match is not waiting on a result.' }, { status: 400 });
    }

    const isCreator = match.creator_id === user.id;
    const isChallenger = match.challenger_id === user.id;
    if (!isCreator && !isChallenger) {
      return Response.json({ error: 'Only the two players can report this result.' }, { status: 403 });
    }

    if (action === 'dispute') {
      const disputed = await base44.asServiceRole.entities.Match.update(match.id, {
        result_disputed: true,
        status: 'awaiting_result',
      });
      return Response.json({ match: disputed });
    }

    if (action === 'confirm') {
      if (!match.reported_winner) {
        return Response.json({ error: 'No result has been reported yet.' }, { status: 400 });
      }
      if (match.reported_by_id === user.id) {
        return Response.json({ error: 'Wait for your opponent to confirm.' }, { status: 400 });
      }
      return Response.json(
        await settlePot(base44, match, match.reported_winner, 'Confirmed by both players'),
      );
    }

    const reportedByOpponent = match.reported_by_id && match.reported_by_id !== user.id;

    // Both players independently named the same winner — release the pot.
    if (reportedByOpponent && match.reported_winner === winner) {
      return Response.json(await settlePot(base44, match, winner, 'Confirmed by both players'));
    }

    const patch = {
      reported_winner: winner,
      reported_by_id: user.id,
      reported_by_handle: handleFor(user),
      reported_at: new Date().toISOString(),
      result_disputed: Boolean(reportedByOpponent && match.reported_winner !== winner),
      status: 'awaiting_result',
    };

    const updated = await base44.asServiceRole.entities.Match.update(match.id, patch);
    return Response.json({ match: updated, disputed: patch.result_disputed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}