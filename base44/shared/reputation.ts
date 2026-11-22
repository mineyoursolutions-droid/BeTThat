// Reputation is derived from settled match history, never stored by hand:
// +6 per net win, -4 per match that had to be resolved by an operator dispute.
const WIN_WEIGHT = 6;
const DISPUTE_PENALTY = 4;

async function asRows(promise) {
  const res = await promise;
  if (Array.isArray(res)) return res;
  return (res && res.items) || [];
}

export function reputationScore({ matches, wins, disputes }) {
  if (!matches) return 50;
  const losses = matches - wins;
  const raw = 50 + (wins - losses) * WIN_WEIGHT - disputes * DISPUTE_PENALTY;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function reputationTier(score, matches) {
  if (!matches) return 'Unrated';
  if (score >= 80) return 'Elite';
  if (score >= 65) return 'Gold';
  if (score >= 50) return 'Silver';
  return 'Bronze';
}

export function tallyMatches(history, userId) {
  return {
    matches: history.length,
    wins: history.filter((m) => m.winner_id === userId).length,
    disputes: history.filter((m) => m.result_disputed).length,
  };
}

// Recomputes from full settled history, so repeated calls stay consistent.
export async function refreshReputation(base44, userId, handle) {
  if (!userId) return null;

  const [asCreator, asChallenger] = await Promise.allSettled([
    asRows(base44.asServiceRole.entities.Match.filter({ creator_id: userId, status: 'settled' })),
    asRows(base44.asServiceRole.entities.Match.filter({ challenger_id: userId, status: 'settled' })),
  ]);

  const history = [
    ...(asCreator.status === 'fulfilled' ? asCreator.value : []),
    ...(asChallenger.status === 'fulfilled' ? asChallenger.value : []),
  ];
  const tally = tallyMatches(history, userId);

  const patch = {
    reputation: reputationScore(tally),
    matches_played: tally.matches,
    matches_won: tally.wins,
    disputes: tally.disputes,
    reputation_updated_at: new Date().toISOString(),
  };

  const existing = await asRows(base44.asServiceRole.entities.PlayerProfile.filter({ user_id: userId }));
  if (existing.length) {
    return base44.asServiceRole.entities.PlayerProfile.update(existing[0].id, patch);
  }
  return base44.asServiceRole.entities.PlayerProfile.create({
    user_id: userId,
    handle: handle || 'player',
    ...patch,
  });
}