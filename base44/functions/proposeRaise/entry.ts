import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { round, requireUser, getMatch, ensureWallet } from '../../shared/wallet.ts';

// Mid-match timeout raise: either player pauses the match and proposes a
// higher stake. The opponent has 60 seconds to accept or decline. No
// money moves at propose time — the top-ups happen in respondRaise, only
// when both players agree and both can cover the difference.
const RAISE_WINDOW_MS = 60_000;

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
    if (match.status !== 'in_play') {
      return Response.json({ error: 'Raises can only be proposed while the match is live.' }, { status: 400 });
    }

    const side =
      match.creator_id === user.id
        ? 'creator'
        : match.challenger_id === user.id
          ? 'challenger'
          : null;
    if (!side) {
      return Response.json({ error: 'Only the two players can raise the stakes.' }, { status: 403 });
    }

    // A stale pending proposal past its deadline is expired first, so a
    // missed countdown never blocks the next raise.
    if (match.raise_status === 'pending') {
      if (match.raise_expires_at && Date.now() > new Date(match.raise_expires_at).getTime()) {
        await base44.asServiceRole.entities.Match.update(match.id, { raise_status: 'expired' });
      } else {
        return Response.json({ error: 'A raise is already on the table.' }, { status: 400 });
      }
    }

    const coin = match.coin;
    const currentStake = round(Number(match.stake) || 0, coin);
    const newStake = round(Number(body.new_stake || 0), coin);
    if (!(newStake > currentStake)) {
      return Response.json({ error: 'The new stake must be higher than the current stake.' }, { status: 400 });
    }
    const topUp = round(newStake - currentStake, coin);

    const wallet = await ensureWallet(base44, user.id, coin);
    if (round(Number(wallet.available || 0), coin) < topUp) {
      return Response.json({ error: 'Not enough available balance to cover the raise.' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Match.update(match.id, {
      raise_status: 'pending',
      raise_proposer_id: user.id,
      raise_proposer_side: side,
      raise_new_stake: newStake,
      raise_expires_at: new Date(Date.now() + RAISE_WINDOW_MS).toISOString(),
    });

    return Response.json({ match: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
