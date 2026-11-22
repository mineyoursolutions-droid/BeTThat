import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    const [settledRes, liveRes, wagerRes, settledCountRes, allWagersRes] = await Promise.all([
      base44.asServiceRole.entities.Match.filter({ status: 'settled' }, { sort: '-updated_date', limit: 10 }),
      base44.asServiceRole.entities.Match.filter(
        { status: { $in: ['open', 'matched', 'in_play'] } },
        { sort: '-created_date', limit: 12 },
      ),
      base44.asServiceRole.entities.Wager.filter({ status: 'locked' }, { sort: '-created_date', limit: 12 }),
      // Live totals (bounded counts — the feed is a live snapshot, not a
      // full audit): games played = settled matches, total wagered =
      // every wager ever locked (player stakes + spectator bets).
      base44.asServiceRole.entities.Match.filter({ status: 'settled' }, { limit: 500 }),
      base44.asServiceRole.entities.Wager.filter({}, { sort: '-created_date', limit: 500 }),
    ]);

    const unwrap = (res) => (Array.isArray(res) ? res : res.items || []);

    const settledAll = unwrap(settledCountRes);
    const allWagers = unwrap(allWagersRes);
    const wageredByCoin = {};
    for (const w of allWagers) {
      const c = w.coin || 'USDT';
      wageredByCoin[c] = (wageredByCoin[c] || 0) + Number(w.amount || 0);
    }
    const liveMatches = unwrap(liveRes).filter((m) => m.status === 'matched' || m.status === 'in_play');
    const totals = {
      gamesPlayed: settledAll.length,
      liveNow: liveMatches.length,
      openChallenges: unwrap(liveRes).filter((m) => m.status === 'open').length,
      wageredByCoin,
    };

    const items = [];

    for (const m of unwrap(settledRes)) {
      const creatorWon = m.winner_id && m.winner_id === m.creator_id;
      const winner = creatorWon ? m.creator_handle : m.challenger_handle;
      if (!winner) continue;
      items.push({
        id: `result-${m.id}`,
        kind: 'result',
        handle: winner,
        opponent: creatorWon ? m.challenger_handle : m.creator_handle,
        game: m.game_name,
        title: m.title,
        coin: m.coin,
        amount: Number(m.stake || 0) * 2,
        at: m.updated_date || m.created_date,
        match_id: m.id,
      });
    }

    for (const m of unwrap(liveRes)) {
      if (m.status === 'open') {
        items.push({
          id: `challenge-${m.id}`,
          kind: 'challenge',
          handle: m.creator_handle,
          game: m.game_name,
          title: m.title,
          coin: m.coin,
          amount: Number(m.stake || 0),
          at: m.created_date,
          match_id: m.id,
        });
      } else {
        items.push({
          id: `live-${m.id}`,
          kind: 'live',
          handle: m.creator_handle,
          opponent: m.challenger_handle,
          game: m.game_name,
          title: m.title,
          coin: m.coin,
          amount: Number(m.stake || 0) * 2,
          at: m.starts_at || m.created_date,
          match_id: m.id,
        });
      }
    }

    for (const w of unwrap(wagerRes)) {
      if (!w.user_handle || w.kind !== 'spectator') continue;
      items.push({
        id: `wager-${w.id}`,
        kind: 'wager',
        handle: w.user_handle,
        side: w.side === 'challenger' ? 'the challenger' : 'the creator',
        game: w.match_title,
        coin: w.coin,
        amount: Number(w.amount || 0),
        at: w.created_date,
        match_id: w.match_id,
      });
    }

    const sorted = items
      .filter((i) => i.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 14);

    return Response.json({ items: sorted, totals });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}