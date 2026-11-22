import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const res = await base44.asServiceRole.entities.Match.filter(
      { status: 'settled' },
      { sort: '-created_date', limit: 500 },
    );
    const matches = Array.isArray(res) ? res : res.items || [];
    const table = new Map();

    const add = (id, handle, won, coin, stake) => {
      if (!id) return;
      const cur = table.get(id) || { user_id: id, handle, wins: 0, losses: 0, matches: 0, coins: {} };
      cur.handle = handle || cur.handle;
      cur.matches += 1;
      if (won) cur.wins += 1;
      else cur.losses += 1;
      cur.coins[coin] = (cur.coins[coin] || 0) + Number(stake || 0);
      table.set(id, cur);
    };

    for (const m of matches) {
      add(m.creator_id, m.creator_handle, m.winner_id === m.creator_id, m.coin, m.stake);
      add(m.challenger_id, m.challenger_handle, m.winner_id === m.challenger_id, m.coin, m.stake);
    }

    const players = Array.from(table.values())
      .map((p) => {
        const coin = Object.keys(p.coins).sort((a, b) => p.coins[b] - p.coins[a])[0] || 'USDT';
        return {
          user_id: p.user_id,
          handle: p.handle,
          wins: p.wins,
          losses: p.losses,
          matches: p.matches,
          win_rate: p.matches ? Math.round((p.wins / p.matches) * 100) : 0,
          volume: p.coins[coin] || 0,
          volume_coin: coin,
        };
      })
      .sort((a, b) => b.wins - a.wins || b.matches - a.matches)
      .slice(0, 20);

    return Response.json({ players });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}