import { round, HOUSE_FEE, moveFunds, recordLedger } from './wallet.ts';
import { refreshReputation } from './reputation.ts';
import { voidOpenMarkets } from './props.ts';

async function lockedWagers(base44, matchId) {
  const res = await base44.asServiceRole.entities.Wager.filter({ match_id: matchId });
  const wagers = Array.isArray(res) ? res : res.items || [];
  return wagers.filter((w) => w.status === 'locked');
}

export async function refundPool(base44, match, note) {
  const locked = await lockedWagers(base44, match.id);
  const results = [];

  for (const w of locked) {
    const wallet = await moveFunds(base44, w.user_id, w.coin, {
      locked: -w.amount,
      available: w.amount,
    });
    await recordLedger(base44, {
      userId: w.user_id,
      coin: w.coin,
      amount: w.amount,
      kind: 'refund',
      description: `Match cancelled · ${match.title}`,
      balanceAfter: wallet.available,
      refId: match.id,
    });
    results.push({ id: w.id, status: 'refunded', payout: w.amount });
  }

  if (results.length) await base44.asServiceRole.entities.Wager.bulkUpdate(results);

  const cancelled = await base44.asServiceRole.entities.Match.update(match.id, {
    status: 'cancelled',
    settle_note: note || 'Cancelled by operator — every stake refunded',
  });

  await voidOpenMarkets(base44, match.id, 'Match cancelled — prop stakes refunded');

  return { match: cancelled, settled: results.length };
}

export async function settlePot(base44, match, winner, note) {
  if (!match.challenger_id) {
    throw new Error('This match has no challenger yet.');
  }

  const coin = match.coin;
  const stake = round(Number(match.stake) || 0, coin);
  const locked = await lockedWagers(base44, match.id);
  const results = [];

  const winnerId = winner === 'creator' ? match.creator_id : match.challenger_id;
  const loserId = winner === 'creator' ? match.challenger_id : match.creator_id;
  const pot = round(stake * 2, coin);
  const payout = round(pot - pot * HOUSE_FEE, coin);

  // The pot settles from the match stakes themselves, so a missing wager row
  // can never strand a player's escrow.
  const winnerWallet = await moveFunds(base44, winnerId, coin, { locked: -stake, available: payout });
  await recordLedger(base44, {
    userId: winnerId,
    coin,
    amount: payout,
    kind: 'payout',
    description: `Match won · ${match.title}`,
    balanceAfter: winnerWallet.available,
    refId: match.id,
  });
  await moveFunds(base44, loserId, coin, { locked: -stake });

  for (const w of locked.filter((x) => x.kind === 'player')) {
    const won = w.user_id === winnerId;
    results.push({ id: w.id, status: won ? 'won' : 'lost', payout: won ? payout : 0 });
  }

  const poolWin = round(
    Number(winner === 'creator' ? match.spectator_pool_creator : match.spectator_pool_challenger) || 0,
    coin,
  );
  const poolLose = round(
    Number(winner === 'creator' ? match.spectator_pool_challenger : match.spectator_pool_creator) || 0,
    coin,
  );
  const totalPool = round(poolWin + poolLose, coin);
  const distributable = round(totalPool - totalPool * HOUSE_FEE, coin);

  for (const w of locked.filter((x) => x.kind === 'spectator')) {
    if (w.side === winner && poolWin > 0) {
      const share = round((Number(w.amount) / poolWin) * distributable, coin);
      const wallet = await moveFunds(base44, w.user_id, coin, { locked: -w.amount, available: share });
      await recordLedger(base44, {
        userId: w.user_id,
        coin,
        amount: share,
        kind: 'payout',
        description: `Spectator payout · ${match.title}`,
        balanceAfter: wallet.available,
        refId: match.id,
      });
      results.push({ id: w.id, status: 'won', payout: share });
    } else if (w.side === winner) {
      await moveFunds(base44, w.user_id, coin, { locked: -w.amount, available: w.amount });
      results.push({ id: w.id, status: 'refunded', payout: w.amount });
    } else {
      await moveFunds(base44, w.user_id, coin, { locked: -w.amount });
      results.push({ id: w.id, status: 'lost', payout: 0 });
    }
  }

  if (results.length) await base44.asServiceRole.entities.Wager.bulkUpdate(results);

  const updated = await base44.asServiceRole.entities.Match.update(match.id, {
    status: 'settled',
    winner_id: winnerId,
    settle_note: note || `Settled · ${winner} took the pot`,
  });

  // Both players' reputation is rebuilt from their full settled history.
  await Promise.allSettled([
    refreshReputation(base44, match.creator_id, match.creator_handle),
    refreshReputation(base44, match.challenger_id, match.challenger_handle),
  ]);

  // Any prop the operator did not resolve before the result refunds in full.
  await voidOpenMarkets(base44, match.id, 'Match settled — unresolved prop stakes refunded');

  return { match: updated, settled: results.length };
}