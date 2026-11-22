import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { round, HOUSE_FEE } from '../../shared/wallet.ts';
import { tallyMatches, reputationScore, reputationTier } from '../../shared/reputation.ts';

const ACTIVE = ['matched', 'in_play', 'awaiting_result'];
const HISTORY_LIMIT = 200;

async function asRows(promise) {
  const res = await promise;
  if (Array.isArray(res)) return res;
  return (res && res.items) || [];
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Spectators can read another player's public form; private wager data stays owner-only.
    const body = await req.json().catch(() => ({}));
    const targetId = String(body.user_id || '').trim() || user.id;
    const isSelf = targetId === user.id;

    const [created, joined, activeCreated, activeJoined, wagers] = await Promise.all([
      asRows(
        base44.entities.Match.filter(
          { creator_id: targetId, status: 'settled' },
          { sort: '-created_date', limit: HISTORY_LIMIT },
        ),
      ),
      asRows(
        base44.entities.Match.filter(
          { challenger_id: targetId, status: 'settled' },
          { sort: '-created_date', limit: HISTORY_LIMIT },
        ),
      ),
      asRows(base44.entities.Match.filter({ creator_id: targetId, status: { $in: ACTIVE } }, { limit: 50 })),
      asRows(base44.entities.Match.filter({ challenger_id: targetId, status: { $in: ACTIVE } }, { limit: 50 })),
      isSelf
        ? asRows(base44.entities.Wager.filter({ user_id: user.id }, { sort: '-created_date', limit: 300 }))
        : [],
    ]);

    const history = [...created, ...joined];

    const results = history
      .map((m) => {
        const stake = round(Number(m.stake) || 0, m.coin);
        const pot = round(stake * 2, m.coin);
        const payout = round(pot - pot * HOUSE_FEE, m.coin);
        const won = m.winner_id === targetId;
        return {
          id: m.id,
          title: m.title,
          game_slug: m.game_slug,
          coin: m.coin,
          stake,
          won,
          disputed: Boolean(m.result_disputed),
          net: won ? round(payout - stake, m.coin) : round(-stake, m.coin),
          date: m.updated_date || m.created_date,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const tally = tallyMatches(history, targetId);

    const byCoinMap = {};
    const coinBucket = (coin) => {
      if (!byCoinMap[coin]) {
        byCoinMap[coin] = {
          coin,
          matches: 0,
          wins: 0,
          staked: 0,
          net: 0,
          spectator_staked: 0,
          spectator_net: 0,
        };
      }
      return byCoinMap[coin];
    };

    for (const r of results) {
      const bucket = coinBucket(r.coin);
      bucket.matches += 1;
      if (r.won) bucket.wins += 1;
      bucket.staked = round(bucket.staked + r.stake, r.coin);
      bucket.net = round(bucket.net + r.net, r.coin);
    }

    let spectatorWon = 0;
    let spectatorLost = 0;
    for (const w of wagers.filter((x) => x.kind !== 'player')) {
      const bucket = coinBucket(w.coin);
      const amount = Number(w.amount) || 0;
      bucket.spectator_staked = round(bucket.spectator_staked + amount, w.coin);
      if (w.status === 'won') {
        bucket.spectator_net = round(bucket.spectator_net + (Number(w.payout) || 0) - amount, w.coin);
        spectatorWon += 1;
      } else if (w.status === 'lost') {
        bucket.spectator_net = round(bucket.spectator_net - amount, w.coin);
        spectatorLost += 1;
      }
    }

    const score = reputationScore(tally);

    return Response.json({
      totals: {
        matches: tally.matches,
        wins: tally.wins,
        losses: tally.matches - tally.wins,
        winRate: tally.matches ? tally.wins / tally.matches : 0,
        disputed: tally.disputes,
        active: activeCreated.length + activeJoined.length,
      },
      byCoin: Object.values(byCoinMap),
      results,
      spectator: { won: spectatorWon, lost: spectatorLost },
      reputation: {
        reputation: score,
        matches_played: tally.matches,
        matches_won: tally.wins,
        disputes: tally.disputes,
        tier: reputationTier(score, tally.matches),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}