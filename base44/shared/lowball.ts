// Lowball — Chang Gang poker. Standalone ace-to-five lowball:
// 5 cards each, one draw (throw back up to 5), a bet after the draw,
// then showdown. The lowest hand wins the whole pot; tied players
// split it. One through five (A-2-3-4-5, the wheel) is the best hand.
// Straights and flushes are ignored; a pair counts against you.
//
// Card codes are two characters: rank + suit, e.g. "As", "Kd", "Qh".
// The undealt deck lives on a PokerHand row owned by '__deck__' (read
// RLS keeps it away from every player; only the service role reads it).

import { HOUSE_FEE, round, moveFunds, recordLedger } from './wallet.ts';
import {
  ACTION_TIMEOUT_MS,
  activePlayers,
  firstActorSeat,
  getTableHands,
  newDeck,
  nextActorSeat,
  rankValue,
  shuffleDeck,
} from './poker.ts';
import { DECK_USER_ID, applyDiscards, getDeckRow, saveDeckRow, getHandRow } from './paduki.ts';

// ---------------------------------------------------------------------------
// 5-card low evaluation (ace-to-five)
// ---------------------------------------------------------------------------

const rankLabel = (v) => (v === 1 ? 'A' : v === 11 ? 'J' : v === 12 ? 'Q' : v === 13 ? 'K' : String(v));

// Score: ranks with A=1, sorted high-to-low. `distinct` is how many
// different ranks the hand holds — a hand with a pair (distinct 4 or
// fewer) always loses to a hand with no pair, however low the pair is.
export function evaluateLow5(cards) {
  const score = cards.map((c) => (rankValue(c) === 14 ? 1 : rankValue(c))).sort((a, b) => b - a);
  const distinct = new Set(score).size;
  const isWheel = score.join(',') === '5,4,3,2,1';
  return {
    score,
    distinct,
    name: isWheel ? 'Wheel · A-2-3-4-5' : `${rankLabel(score[0])}-low`,
    cards,
  };
}

// 1 if a wins (lower), -1 if b wins, 0 if tied. More distinct ranks
// wins first; among hands with the same distinct count the lower
// lexicographic score wins.
export function compareLow5(a, b) {
  if (a.distinct !== b.distinct) return a.distinct > b.distinct ? 1 : -1;
  for (let i = 0; i < 5; i++) {
    if (a.score[i] !== b.score[i]) return a.score[i] < b.score[i] ? 1 : -1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Deal
// ---------------------------------------------------------------------------

// Deal 5-card lowball hands: shuffle a fresh deck, deal 5 to each
// player, stash the rest as the deck row. Returns { handsByUser, deck }.
export async function dealLowballHands(base44, table, players) {
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
  const rest = deck.slice(players.length * 5);
  await base44.asServiceRole.entities.PokerHand.create({
    table_id: table.id,
    user_id: DECK_USER_ID,
    cards_json: JSON.stringify(rest),
  });
  return { handsByUser, deck: rest };
}

// ---------------------------------------------------------------------------
// Draw + betting state machine
// ---------------------------------------------------------------------------
//
// The hand has two passes: a draw pass (each active player draws or
// folds, in turn order) and then a betting pass (check / bet / call /
// fold). When the betting pass completes the hand goes to showdown.
// reveal_round is 0 during the draw pass and 1 once the betting pass
// has opened.

function drawPassActive(players) {
  return activePlayers(players).some((p) => !p.drawn);
}

function nextDrawSeat(players, fromSeat) {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const seat = (fromSeat + step) % n;
    if (!players[seat].folded && !players[seat].drawn) return seat;
  }
  return null;
}

function startBettingPass(table, players) {
  table.reveal_round = 1;
  table.current_bet = 0;
  for (const p of players) {
    p.round_paid = 0;
    p.acted = false;
  }
  const seat = firstActorSeat(players, Number(table.dealer_seat || 0));
  table.turn_user_id = seat === null ? '' : players[seat].user_id;
  table.turn_expires_at = seat === null ? '' : new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
}

// Advance after one player has acted. Returns 'continue' |
// 'last-standing' | 'showdown'.
export function advanceAfterLowballAction(table, players, actedSeat) {
  const active = activePlayers(players);
  if (active.length <= 1) return 'last-standing';

  // Draw pass: move to the next player who still has to draw.
  if (drawPassActive(players)) {
    const next = nextDrawSeat(players, actedSeat);
    if (next !== null) {
      table.turn_user_id = players[next].user_id;
      table.turn_expires_at = new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
      return 'continue';
    }
    // Everyone drew — open the betting pass.
    startBettingPass(table, players);
    return 'continue';
  }

  // Betting pass: move to the next player who still owes action.
  const next = nextActorSeat(players, actedSeat, Number(table.current_bet || 0));
  if (next !== null) {
    table.turn_user_id = players[next].user_id;
    table.turn_expires_at = new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
    return 'continue';
  }

  // Betting round complete — showdown.
  return 'showdown';
}

// Apply one action for a seat. Returns { outcome, error, newHand?,
// newDeck? }. `hand` is the acting player's current 5 cards, `deck`
// the undealt cards. When the action is a draw, newHand/newDeck carry
// the updated cards for the caller to persist (PokerHand row + deck row).
export function applyLowballAction(table, players, seat, action, discards, hand, deck) {
  const player = players[seat];
  if (!player) return { error: 'Seat not found.' };
  if (player.folded) return { error: 'You have folded.' };
  if (table.turn_user_id !== player.user_id) return { error: 'It is not your turn.' };

  const coin = table.coin;
  const betUnit = round(Number(table.bet_unit || 0), coin);

  if (table.phase !== 'betting') return { error: 'Betting is closed right now.' };

  // Draw pass.
  if (drawPassActive(players)) {
    if (action === 'fold') {
      player.folded = true;
      player.drawn = true;
      const outcome = advanceAfterLowballAction(table, players, seat);
      return { outcome };
    }
    if (action !== 'draw') return { error: 'Draw your cards first — pick up to five to throw back, or fold.' };
    const list = Array.isArray(discards) ? [...new Set(discards.map(Number))] : [];
    if (list.length > 5) return { error: 'You can throw back at most five cards.' };
    if (list.some((i) => !Number.isInteger(i) || i < 0 || i > 4)) {
      return { error: 'Pick the cards to throw back.' };
    }
    if (!hand || hand.length !== 5) return { error: 'Your hand is not ready.' };
    if (deck.length < list.length) return { error: 'Not enough cards left in the deck.' };
    const { hand: newHand, deck: newDeckCards } = applyDiscards(hand, list, deck);
    player.drawn = true;
    const outcome = advanceAfterLowballAction(table, players, seat);
    return { outcome, newHand, newDeck: newDeckCards };
  }

  // Betting pass.
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
  const outcome = advanceAfterLowballAction(table, players, seat);
  return { outcome };
}

// Timeout auto-action: stand pat in a draw pass, check if possible
// otherwise fold in a betting pass.
export function applyTimeoutLowballAction(table, players) {
  const seat = players.findIndex((p) => p.user_id === table.turn_user_id);
  if (seat < 0) return 'continue';
  const player = players[seat];
  if (player.folded) return 'continue';
  if (drawPassActive(players)) {
    // Stand pat: draw nothing, move on.
    player.drawn = true;
    return advanceAfterLowballAction(table, players, seat);
  }
  if (player.acted && Number(player.round_paid || 0) >= Number(table.current_bet || 0)) return 'continue';
  const currentBet = round(Number(table.current_bet || 0), table.coin);
  const paid = round(Number(player.round_paid || 0), table.coin);
  if (paid >= currentBet) {
    player.acted = true;
    return advanceAfterLowballAction(table, players, seat);
  }
  player.folded = true;
  player.acted = true;
  return advanceAfterLowballAction(table, players, seat);
}

export function advanceTimeoutsLowball(table, players) {
  let changed = false;
  for (let i = 0; i < 10; i++) {
    if (table.status !== 'in_play') break;
    if (!table.turn_expires_at) break;
    if (Date.now() <= new Date(table.turn_expires_at).getTime()) break;
    const outcome = applyTimeoutLowballAction(table, players);
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

// Settle a Lowball hand: the best (lowest) ace-to-five hand takes the
// whole pot; tied players split it. 5% house fee, unspent stacks
// returned — the same payout path as the other Chang Gang games.
export async function settleLowball(base44, table, players, mode, lastStandingUserId) {
  const coin = table.coin;
  const stake = round(Number(table.stake || 0), coin);
  const handsByUser = await getTableHands(base44, table.id);

  for (const p of players) {
    const hand = handsByUser[p.user_id] || [];
    if (hand.length === 5 && !p.folded) {
      p.best_low = evaluateLow5(hand);
    }
  }

  const pot = round(
    players.reduce((sum, p) => sum + Number(p.contributed || 0), 0),
    coin,
  );
  const fee = round(pot * HOUSE_FEE, coin);
  const distributable = round(pot - fee, coin);

  const shares = {};
  const winners = { high: [], low: [] };
  let note = '';

  if (mode === 'last-standing') {
    const winner = players.find((p) => p.user_id === lastStandingUserId) || activePlayers(players)[0];
    if (winner) {
      shares[winner.user_id] = distributable;
      winners.low = [winner.user_id];
      note = `${winner.handle || 'Last player standing'} took the pot — everyone else folded`;
    }
  } else {
    const active = activePlayers(players);
    const pool = active.filter((p) => p.best_low);
    let best = null;
    for (const p of pool) {
      if (!best || compareLow5(p.best_low, best.best_low) > 0) best = p;
    }
    const lowWinners = best ? pool.filter((p) => compareLow5(p.best_low, best.best_low) === 0) : [];
    winners.low = lowWinners.map((p) => p.user_id);
    if (lowWinners.length) {
      const each = round(distributable / lowWinners.length, coin);
      lowWinners.forEach((p, i) => {
        const share = i === 0 ? round(distributable - each * (lowWinners.length - 1), coin) : each;
        shares[p.user_id] = round((shares[p.user_id] || 0) + share, coin);
      });
    }
    note = `Low: ${lowWinners.map((p) => p.handle).join(', ') || '—'}`;
  }

  // Pay out: unspent stack back + winnings. Losers' escrowed buy-in
  // funds the pot; the 5% fee is retained by the house.
  for (const p of players) {
    const win = round(shares[p.user_id] || 0, coin);
    const credit = round(Number(p.stack || 0) + win, coin);
    const wallet = await moveFunds(base44, p.user_id, coin, { locked: -stake, available: credit });
    await recordLedger(base44, {
      userId: p.user_id,
      coin,
      amount: credit,
      kind: win > 0 ? 'payout' : 'refund',
      description: win > 0 ? `Lowball win · ${table.title}` : `Lowball · ${table.title}`,
      balanceAfter: wallet.available,
      refId: table.id,
    });
    p.result = {
      won_high: false,
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
            best_low: p.best_low,
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

export { getDeckRow, saveDeckRow, getHandRow };
