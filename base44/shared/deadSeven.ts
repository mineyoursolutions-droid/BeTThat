// Dead Seven — Chain Gang poker. Five cards each, no draws: one
// betting round, then showdown. The object is to make one of each
// suit — each player's best 4-card one-of-each-suit hand from the
// five dealt is read both ways (cards speak), and the pot splits
// between the best high hand and the best low hand. K-Q-J-T one of
// each suit is the best high hand; A-2-3-4 one of each suit is the
// best low hand.
//
// Rules clarified by the user (2026-11-22):
// - 5 cards dealt. A 7 in your hand kills your hand — any 7 among
//   the five dealt cards and the hand is dead, it cannot win
//   anything, even if the best four would not include the 7.
// - Rank bands: A-6 (ranks 1-6) play lowball / low Paduki; ranks
//   8-K (8 and above) play highball / high Paduki.
// - Builder default: a made 4-card hand must be all-low to qualify
//   as low or all-high to qualify as high; a made hand mixing low
//   and high cards qualifies as neither and cannot win.
//
// Card codes are two characters: rank + suit, e.g. "As", "Kd", "Qh".

import { HOUSE_FEE, round, moveFunds, recordLedger } from './wallet.ts';
import {
  ACTION_TIMEOUT_MS,
  activePlayers,
  firstActorSeat,
  getTableHands,
  newDeck,
  nextActorSeat,
  shuffleDeck,
} from './poker.ts';
import { bestHigh4of5, bestLow4of5, compareHigh4, compareLow4, hasDeadSeven } from './paduki.ts';

// ---------------------------------------------------------------------------
// Deal
// ---------------------------------------------------------------------------

// Deal 5-card Dead Seven hands: shuffle a fresh deck, deal 5 to each
// player. There are no draws, so no deck row is stashed.
export async function dealDeadSevenHands(base44, table, players) {
  const deck = shuffleDeck(newDeck());
  const handsByUser = {};
  for (let i = 0; i < players.length; i++) {
    const hand = deck.slice(i * 5, i * 5 + 5);
    handsByUser[players[i].user_id] = hand;
    await base44.asServiceRole.entities.PokerHand.create({
      table_id: table.id,
      user_id: players[i].user_id,
      cards_json: JSON.stringify(hand),
    });
  }
  return { handsByUser, deck: deck.slice(players.length * 5) };
}

// ---------------------------------------------------------------------------
// Betting state machine (one round, then showdown)
// ---------------------------------------------------------------------------

// Advance after one player has acted. Returns 'continue' |
// 'last-standing' | 'showdown'.
export function advanceAfterDeadSevenAction(table, players, actedSeat) {
  const active = activePlayers(players);
  if (active.length <= 1) return 'last-standing';

  const next = nextActorSeat(players, actedSeat, Number(table.current_bet || 0));
  if (next !== null) {
    table.turn_user_id = players[next].user_id;
    table.turn_expires_at = new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
    return 'continue';
  }

  return 'showdown';
}

// Apply one betting action for a seat: check / bet / call / fold.
// Returns { outcome, error }.
export function applyDeadSevenAction(table, players, seat, action) {
  const player = players[seat];
  if (!player) return { error: 'Seat not found.' };
  if (player.folded) return { error: 'You have folded.' };
  if (table.turn_user_id !== player.user_id) return { error: 'It is not your turn.' };
  if (table.phase !== 'betting') return { error: 'Betting is closed right now.' };

  const coin = table.coin;
  const betUnit = round(Number(table.bet_unit || 0), coin);
  const currentBet = round(Number(table.current_bet || 0), coin);
  const paid = round(Number(player.round_paid || 0), coin);

  if (action === 'check') {
    if (paid < currentBet) return { error: 'There is a bet to call — check is not possible.' };
  } else if (action === 'bet') {
    if (currentBet > 0) return { error: 'There is already a bet — call or fold.' };
    if (Number(player.stack || 0) < betUnit) return { error: 'Not enough chips to bet.' };
    player.stack = round(Number(player.stack || 0) - betUnit, coin);
    player.contributed = round(Number(player.contributed || 0) + betUnit, coin);
    player.round_paid = round(paid + betUnit, coin);
    table.current_bet = betUnit;
    table.pot = round(Number(table.pot || 0) + betUnit, coin);
  } else if (action === 'call') {
    const owed = round(currentBet - paid, coin);
    if (owed <= 0) return { error: 'Nothing to call — check instead.' };
    if (Number(player.stack || 0) < owed) return { error: 'Not enough chips to call.' };
    player.stack = round(Number(player.stack || 0) - owed, coin);
    player.contributed = round(Number(player.contributed || 0) + owed, coin);
    player.round_paid = round(paid + owed, coin);
    table.pot = round(Number(table.pot || 0) + owed, coin);
  } else if (action === 'fold') {
    player.folded = true;
  } else {
    return { error: 'Unknown action.' };
  }

  player.acted = true;
  const outcome = advanceAfterDeadSevenAction(table, players, seat);
  return { outcome };
}

// Timeout auto-action: check if possible, otherwise fold.
export function applyTimeoutDeadSevenAction(table, players) {
  const seat = players.findIndex((p) => p.user_id === table.turn_user_id);
  if (seat < 0) return 'continue';
  const player = players[seat];
  if (player.folded) return 'continue';
  if (player.acted && Number(player.round_paid || 0) >= Number(table.current_bet || 0)) return 'continue';
  const currentBet = round(Number(table.current_bet || 0), table.coin);
  const paid = round(Number(player.round_paid || 0), table.coin);
  if (paid >= currentBet) {
    player.acted = true;
    return advanceAfterDeadSevenAction(table, players, seat);
  }
  player.folded = true;
  player.acted = true;
  return advanceAfterDeadSevenAction(table, players, seat);
}

export function advanceTimeoutsDeadSeven(table, players) {
  let changed = false;
  for (let i = 0; i < 10; i++) {
    if (table.status !== 'in_play') break;
    if (!table.turn_expires_at) break;
    if (Date.now() <= new Date(table.turn_expires_at).getTime()) break;
    const outcome = applyTimeoutDeadSevenAction(table, players);
    changed = true;
    if (outcome !== 'continue') {
      table._pendingOutcome = outcome;
      break;
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

// Settle a Dead Seven hand: every active player's best 4-card
// one-of-each-suit hand from the five dealt is read both ways (cards
// speak) and the pot splits between the best high hand and the best
// low hand. A hand holding a 7 is dead and wins nothing. 5% house
// fee, unspent stacks returned — the same payout path as the other
// Chain Gang games.
export async function settleDeadSeven(base44, table, players, mode, lastStandingUserId, opts = {}) {
  const coin = table.coin;
  // Play-money tables settle in chips only: no house fee, no wallet
  // moves, no ledger entries. Real-money tables settle exactly as before.
  const playMoney = opts.playMoney === true;
  const stake = round(Number(table.stake || 0), coin);
  const handsByUser = await getTableHands(base44, table.id);

  for (const p of players) {
    const hand = handsByUser[p.user_id] || [];
    if (hand.length === 5 && !p.folded) {
      if (hasDeadSeven(hand)) {
        // A 7 anywhere in the five dealt cards kills the hand — it
        // cannot win either half, even if the best four would not
        // include the 7.
        p.dead = true;
        p.best_high = null;
        p.best_low = null;
      } else {
        p.dead = false;
        p.best_high = bestHigh4of5(hand);
        p.best_low = bestLow4of5(hand);
      }
    }
  }

  const pot = round(
    players.reduce((sum, p) => sum + Number(p.contributed || 0), 0),
    coin,
  );
  const fee = playMoney ? 0 : round(pot * HOUSE_FEE, coin);
  const distributable = round(pot - fee, coin);

  const shares = {};
  const winners = { high: [], low: [] };
  let note = '';

  if (mode === 'last-standing') {
    const winner = players.find((p) => p.user_id === lastStandingUserId) || activePlayers(players)[0];
    if (winner) {
      shares[winner.user_id] = distributable;
      winners.high = [winner.user_id];
      winners.low = [winner.user_id];
      note = `${winner.handle || 'Last player standing'} took the pot — everyone else folded`;
    }
  } else {
    const active = activePlayers(players);
    let bestHigh = null;
    for (const p of active) {
      if (p.best_high && (!bestHigh || compareHigh4(p.best_high, bestHigh.best_high) > 0)) bestHigh = p;
    }
    let bestLow = null;
    for (const p of active) {
      if (p.best_low && (!bestLow || compareLow4(p.best_low, bestLow.best_low) > 0)) bestLow = p;
    }
    const highWinners = bestHigh
      ? active.filter((p) => p.best_high && compareHigh4(p.best_high, bestHigh.best_high) === 0)
      : [];
    const lowWinners = bestLow
      ? active.filter((p) => p.best_low && compareLow4(p.best_low, bestLow.best_low) === 0)
      : [];

    winners.high = highWinners.map((p) => p.user_id);
    winners.low = lowWinners.map((p) => p.user_id);

    let highHalf = 0;
    let lowHalf = 0;
    if (highWinners.length && lowWinners.length) {
      highHalf = round(distributable / 2, coin);
      lowHalf = round(distributable - highHalf, coin);
    } else if (highWinners.length) {
      highHalf = distributable;
    } else if (lowWinners.length) {
      lowHalf = distributable;
    }

    const splitHalf = (half, list) => {
      if (!list.length || half <= 0) return;
      const each = round(half / list.length, coin);
      list.forEach((p, i) => {
        const share = i === 0 ? round(half - each * (list.length - 1), coin) : each;
        shares[p.user_id] = round((shares[p.user_id] || 0) + share, coin);
      });
    };
    splitHalf(highHalf, highWinners);
    splitHalf(lowHalf, lowWinners);

    const highHandles = highWinners.map((p) => p.handle).join(', ') || '—';
    const lowHandles = lowWinners.map((p) => p.handle).join(', ') || '—';
    note = `High: ${highHandles} · Low: ${lowHandles}`;
  }

  // Pay out: unspent stack back + winnings. Losers' escrowed buy-in
  // funds the pot; the 5% fee is retained by the house. On a play-money
  // table there is no escrow to move, so the chips just stay in the
  // result — no wallet, no ledger.
  for (const p of players) {
    const win = round(shares[p.user_id] || 0, coin);
    const credit = round(Number(p.stack || 0) + win, coin);
    if (!playMoney) {
      const wallet = await moveFunds(base44, p.user_id, coin, { locked: -stake, available: credit });
      await recordLedger(base44, {
        userId: p.user_id,
        coin,
        amount: credit,
        kind: win > 0 ? 'payout' : 'refund',
        description: win > 0 ? `Dead Seven win · ${table.title}` : `Dead Seven · ${table.title}`,
        balanceAfter: wallet.available,
        refId: table.id,
      });
    }
    p.result = {
      won_high: winners.high.includes(p.user_id),
      won_low: winners.low.includes(p.user_id),
      winnings: win,
      credit,
    };
  }

  const patch = {
    status: 'settled',
    phase: 'showdown',
    pot,
    players_json: JSON.stringify(players),
    result_json: JSON.stringify({
      mode,
      winners,
      fee,
      pot,
      distributable,
      note,
      hands: Object.fromEntries(
        players.map((p) => [
          p.user_id,
          {
            handle: p.handle,
            best_high: p.best_high,
            best_low: p.best_low,
            dead: !!p.dead,
            folded: p.folded,
          },
        ]),
      ),
    }),
    settle_note: note,
    turn_user_id: '',
    turn_expires_at: '',
    version: Number(table.version || 0) + 1,
  };
  const updated = await base44.asServiceRole.entities.PokerTable.update(table.id, patch);
  return { table: updated, winners, note };
}
