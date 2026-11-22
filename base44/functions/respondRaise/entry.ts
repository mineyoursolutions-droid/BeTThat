import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { round, requireUser, getMatch, ensureWallet, moveFunds, recordLedger } from '../../shared/wallet.ts';

// Answer a pending timeout raise. Only the opponent answers — the
// proposer already committed by proposing. On accept, BOTH players top
// up (new stake minus current stake) from their available balance into
// escrow; if either cannot cover it, the raise fails and the match
// resumes at the original stake with no money moved. On decline, or if
// the 60-second window has passed, the match simply resumes.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '').trim();
    const action = body.action === 'accept' ? 'accept' : 'decline';
    if (!matchId) return Response.json({ error: 'match_id is required' }, { status: 400 });

    const match = await getMatch(base44, matchId);
    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 });
    if (match.raise_status !== 'pending') {
      return Response.json({ error: 'There is no raise waiting on a decision.' }, { status: 400 });
    }

    // The window closed while the answer was in flight — expire it.
    if (match.raise_expires_at && Date.now() > new Date(match.raise_expires_at).getTime()) {
      const expired = await base44.asServiceRole.entities.Match.update(match.id, { raise_status: 'expired' });
      return Response.json({ match: expired, expired: true });
    }

    if (match.raise_proposer_id === user.id) {
      return Response.json({ error: 'You proposed this raise — wait for your opponent.' }, { status: 400 });
    }
    const isPlayer = match.creator_id === user.id || match.challenger_id === user.id;
    if (!isPlayer) {
      return Response.json({ error: 'Only the two players can answer a raise.' }, { status: 403 });
    }

    if (action === 'decline') {
      const updated = await base44.asServiceRole.entities.Match.update(match.id, { raise_status: 'declined' });
      return Response.json({ match: updated });
    }

    const coin = match.coin;
    const currentStake = round(Number(match.stake) || 0, coin);
    const newStake = round(Number(match.raise_new_stake) || 0, coin);
    const topUp = round(newStake - currentStake, coin);
    if (!(topUp > 0)) {
      return Response.json({ error: 'This raise is no longer valid.' }, { status: 400 });
    }

    const players = [
      { id: match.creator_id },
      { id: match.challenger_id },
    ];

    // Both players must be able to cover the top-up before any money moves.
    for (const p of players) {
      const wallet = await ensureWallet(base44, p.id, coin);
      if (round(Number(wallet.available || 0), coin) < topUp) {
        const expiredMatch = await base44.asServiceRole.entities.Match.update(match.id, {
          raise_status: 'expired',
        });
        return Response.json(
          {
            error: 'One of the players no longer has the balance to cover the raise.',
            match: expiredMatch,
          },
          { status: 400 },
        );
      }
    }

    // Move both top-ups; if the second fails, roll the first back so a
    // raise never moves money for only one player.
    const moved = [];
    try {
      for (const p of players) {
        const wallet = await moveFunds(base44, p.id, coin, { available: -topUp, locked: topUp });
        moved.push(p.id);
        await recordLedger(base44, {
          userId: p.id,
          coin,
          amount: -topUp,
          kind: 'stake',
          description: `Raise the stakes · ${match.title}`,
          balanceAfter: wallet.available,
          refId: match.id,
        });
      }
    } catch (err) {
      for (const id of moved) {
        await moveFunds(base44, id, coin, { available: topUp, locked: -topUp }).catch(() => {});
      }
      return Response.json({ error: 'Not enough available balance to cover the raise.' }, { status: 400 });
    }

    // Keep the player wager rows at the new stake so settlement (which
    // releases match.stake per player) stays consistent. Spectator
    // wagers are untouched.
    const wagersRes = await base44.asServiceRole.entities.Wager.filter({ match_id: match.id });
    const wagers = Array.isArray(wagersRes) ? wagersRes : wagersRes.items || [];
    const playerWagers = wagers.filter((w) => w.kind === 'player' && w.status === 'locked');
    if (playerWagers.length) {
      await base44.asServiceRole.entities.Wager.bulkUpdate(
        playerWagers.map((w) => ({ id: w.id, amount: newStake })),
      );
    }

    const updated = await base44.asServiceRole.entities.Match.update(match.id, {
      stake: newStake,
      raise_status: 'accepted',
      raise_count: Number(match.raise_count || 0) + 1,
    });

    return Response.json({ match: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
