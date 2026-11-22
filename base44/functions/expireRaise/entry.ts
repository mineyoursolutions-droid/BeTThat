import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, getMatch } from '../../shared/wallet.ts';

// Sweep for a pending timeout raise whose 60-second window has passed:
// flip it to expired so the match resumes at the original stake. The
// match page calls this from its live poll when it sees a pending raise
// past its deadline; respondRaise re-checks the deadline server-side too.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '').trim();
    if (!matchId) return Response.json({ error: 'match_id is required' }, { status: 400 });

    const match = await getMatch(base44, matchId);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });
    if (match.raise_status !== 'pending') return Response.json({ match });

    if (match.raise_expires_at && Date.now() > new Date(match.raise_expires_at).getTime()) {
      const updated = await base44.asServiceRole.entities.Match.update(match.id, { raise_status: 'expired' });
      return Response.json({ match: updated, expired: true });
    }

    return Response.json({ match });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
