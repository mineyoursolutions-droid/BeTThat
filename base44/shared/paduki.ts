// Paduki (NOT Paducah — that is a city in Kentucky) and Straight High.
// Shared 4-card draw engine for the Chain Gang poker family.
//
// Paduki rules (the user's own):
// - 4 cards each. A made hand must have one of each suit — one diamond,
//   one spade, one heart, one club.
// - High Paduki: the best hand is K-Q-J-T, one of each suit — the high
//   wheel. Low Paduki: the best hand is A-2-3-4, one of each suit — the
//   low wheel.
// - Draws: after the first four cards, draw three, then two, then one.
//   First draw you may throw back up to 3 cards and get that many new
//   ones (1, 2 or 3); second draw throw back up to 2; third and final
//   draw throw back exactly 1. A bet follows each draw.
// - At the end the player declares which way they are going, or the
//   cards speak for themselves.
// - Sometimes stipulation: "eight or higher is high" (not implemented —
//   see the report; the user has not said what it gates).
//
// Straight High is High Paduki: same deal and draws, high hand only,
// no declare — the best high Paduki hand wins the whole pot.
//
// Card codes are two characters: rank + suit, e.g. "As", "Kd", "Qh".
// The undealt deck lives on a PokerHand row owned by '__deck__' (read
// RLS keeps it away from every player; only the service role reads it).

import { HOUSE_FEE, round, moveFunds, recordLedger } from './wallet.ts';
import {
  ACTION_TIMEOUT_MS,
  activePlayers,
  chooseBettingMove,
  driveBotTurns,
  firstActorSeat,
  getTableHands,
  newDeck,
  nextActorSeat,
  rankValue,
  shuffleDeck,
  suitOf,
} from './poker.ts';

export const DRAW_LIMITS = [3, 2, 1]; // max discards on draws 1, 2, 3
export const DECK_USER_ID = '__deck__';

// ---------------------------------------------------------------------------
// 4-card Paduki evaluation
// ---------------------------------------------------------------------------

export function isMade4(cards) {
  return new Set(cards.map(suitOf)).size === 4;
}

const rankLabel = (v) => (v === 14 ? 'A' : v === 13 ? 'K' : v === 12 ? 'Q' : v === 11 ? 'J' : String(v));

function straightHigh4(distinct) {
  if (distinct.length !== 4) return 0;
  if (distinct[0] - distinct[3] === 3) return distinct[0];
  if (distinct[0] === 14 && distinct[1] === 4 && distinct[2] === 3 && distinct[3] === 2) return 4; // A-2-3-4
  return 0;
}

// High evaluation for a 4-card hand. Made hands (one of each suit)
// always beat unmade hands. The K-Q-J-T wheel is the best hand of all.
export function evaluateHigh4(cards) {
  const made = isMade4(cards);
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const distinct = [...new Set(values)].sort((a, b) => b - a);
  const straight = straightHigh4(distinct);
  const isWheel = values.join(',') === '13,12,11,10';

  const groups = [];
  for (const v of distinct) {
    groups.push({ rank: v, count: values.filter((x) => x === v).length });
  }
  groups.sort((a, b) => b.count - a.count || b.rank - a.rank);
  const counts = groups.map((g) => g.count);

  let category;
  let tiebreak;
  let name;
  if (isWheel) {
    category = 6;
    tiebreak = [0];
    name = 'Wheel · K-Q-J-T';
  } else if (counts[0] === 4) {
    category = 5;
    tiebreak = [groups[0].rank];
    name = `Four ${rankLabel(groups[0].rank)}s`;
  } else if (straight) {
    category = 4;
    tiebreak = [straight];
    name = `Straight · ${rankLabel(straight)} high`;
  } else if (counts[0] === 3) {
    category = 3;
    tiebreak = [groups[0].rank, groups[1].rank];
    name = `Three ${rankLabel(groups[0].rank)}s`;
  } else if (counts[0] === 2 && counts[1] === 2) {
    category = 2;
    tiebreak = [groups[0].rank, groups[1].rank];
    name = 'Two Pair';
  } else if (counts[0] === 2) {
    category = 1;
    tiebreak = [groups[0].rank, ...groups.slice(1).map((g) => g.rank)];
    name = `Pair of ${rankLabel(groups[0].rank)}s`;
  } else {
    category = 0;
    tiebreak = values;
    name = `High Card ${rankLabel(values[0])}`;
  }

  // Unmade hands sit below every made hand.
  if (!made) {
    return { category: -1, tiebreak: values, name: `${name} · not made`, cards, made };
  }
  return { category, tiebreak, name, cards, made };
}

export function compareHigh4(a, b) {
  if (a.category !== b.category) return a.category > b.category ? 1 : -1;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const x = a.tiebreak[i] || 0;
    const y = b.tiebreak[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// Low evaluation for a 4-card hand (ace-to-five: straights and flushes
// ignored, lowest cards win; A-2-3-4 is the best possible low hand).
// Made hands beat unmade hands; among hands of the same made-ness the
// lower score wins.
export function evaluateLow4(cards) {
  const made = isMade4(cards);
  const score = cards.map((c) => (rankValue(c) === 14 ? 1 : rankValue(c))).sort((a, b) => b - a);
  const isWheel = score.join(',') === '4,3,2,1';
  return { score, made, name: isWheel ? 'Wheel · A-2-3-4' : made ? `${score[0] === 1 ? 'A' : score[0]}-low` : `${score[0] === 1 ? 'A' : score[0]}-low · not made`, cards };
}

export function compareLow4(a, b) {
  if (a.made !== b.made) return a.made ? 1 : -1;
  for (let i = 0; i < 4; i++) {
    if (a.score[i] !== b.score[i]) return a.score[i] < b.score[i] ? 1 : -1;
  }
  return 0;
}

function combinations(arr, k) {
  const out = [];
  const walk = (start, picked) => {
    if (picked.length === k) {
      out.push([...picked]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      picked.push(arr[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return out;
}

// Best 4-card high hand out of 7 (kept as a shared helper; Dead
// Seven now deals 5 and uses bestHigh4of5 below).
export function bestHigh4of7(cards7) {
  let best = null;
  for (const combo of combinations(cards7, 4)) {
    const ev = evaluateHigh4(combo);
    if (!best || compareHigh4(ev, best) > 0) best = ev;
  }
  return best;
}

// Best 4-card low hand out of 7.
export function bestLow4of7(cards7) {
  let best = null;
  for (const combo of combinations(cards7, 4)) {
    const ev = evaluateLow4(combo);
    if (!best || compareLow4(ev, best) > 0) best = ev;
  }
  return best;
}

// Dead Seven — best 4-card hand out of the 5 dealt, with the rank
// bands the user clarified (2026-11-22): ranks A-6 play low, ranks
// 8-K play high, and a 7 in the hand kills it. A made 4-card hand
// must be all-low to qualify as low or all-high to qualify as high;
// a made hand mixing low and high cards qualifies as neither
// (builder default). Aces count as 1 for the low band and 14 for the
// high band, as in Paduki.
export function hasDeadSeven(cards) {
  return cards.some((c) => rankValue(c) === 7);
}

export function bestHigh4of5(cards5) {
  let best = null;
  for (const combo of combinations(cards5, 4)) {
    if (!combo.every((c) => rankValue(c) >= 8)) continue;
    const ev = evaluateHigh4(combo);
    if (!best || compareHigh4(ev, best) > 0) best = ev;
  }
  return best;
}

export function bestLow4of5(cards5) {
  let best = null;
  for (const combo of combinations(cards5, 4)) {
    if (!combo.every((c) => (rankValue(c) === 14 ? 1 : rankValue(c)) <= 6)) continue;
    const ev = evaluateLow4(combo);
    if (!best || compareLow4(ev, best) > 0) best = ev;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Deck storage (PokerHand row owned by '__deck__')
// ---------------------------------------------------------------------------

async function asRows(promise) {
  const res = await promise;
  if (Array.isArray(res)) return res;
  return (res && res.items) || [];
}

export async function getDeckRow(base44, tableId) {
  const rows = await asRows(
    base44.asServiceRole.entities.PokerHand.filter({ table_id: tableId, user_id: DECK_USER_ID }, { limit: 1 }),
  );
  if (!rows.length) return null;
  let cards = [];
  try {
    cards = JSON.parse(rows[0].cards_json || '[]');
  } catch {
    cards = [];
  }
  return { id: rows[0].id, cards };
}

export async function saveDeckRow(base44, rowId, cards) {
  return base44.asServiceRole.entities.PokerHand.update(rowId, { cards_json: JSON.stringify(cards) });
}

// The PokerHand row holding one player's cards (needed to persist a
// draw — the row id is not part of the cards map).
export async function getHandRow(base44, tableId, userId) {
  const rows = await asRows(
    base44.asServiceRole.entities.PokerHand.filter({ table_id: tableId, user_id: userId }, { limit: 1 }),
  );
  if (!rows.length) return null;
  let cards = [];
  try {
    cards = JSON.parse(rows[0].cards_json || '[]');
  } catch {
    cards = [];
  }
  return { id: rows[0].id, cards };
}

// Deal 4-card draw hands: shuffle a fresh deck, deal 4 to each player,
// stash the rest as the deck row. Returns { handsByUser, deck }.
export async function dealDrawHands(base44, table, players) {
  const deck = shuffleDeck(newDeck());
  const handsByUser = {};
  for (let i = 0; i < players.length; i++) {
    const hand = deck.slice(i * 4, i * 4 + 4);
    handsByUser[players[i].user_id] = hand;
    await base44.asServiceRole.entities.PokerHand.create({
      table_id: table.id,
      user_id: players[i].user_id,
      cards_json: JSON.stringify(hand),
    });
  }
  const rest = deck.slice(players.length * 4);
  await base44.asServiceRole.entities.PokerHand.create({
    table_id: table.id,
    user_id: DECK_USER_ID,
    cards_json: JSON.stringify(rest),
  });
  return { handsByUser, deck: rest };
}

// Replace the discarded cards in a hand with the top cards of the deck.
// discards: indices into the hand (0-based). Returns { hand, deck }.
export function applyDiscards(hand, discards, deck) {
  const keep = hand.filter((_, i) => !discards.includes(i));
  const drawn = deck.slice(0, discards.length);
  return { hand: [...keep, ...drawn], deck: deck.slice(discards.length) };
}

// ---------------------------------------------------------------------------
// Draw-game state machine
// ---------------------------------------------------------------------------
//
// table.reveal_round counts completed draws (0 = dealt, waiting on
// draw 1; 1 = after draw 1; 2 = after draw 2; 3 = after draw 3).
// Each player carries `drawn` (drew this round yet). While any active
// player has drawn === false the table is in the draw pass: the turn
// player's only moves are 'draw' (with discards) or 'fold'. Once
// everyone has drawn, the betting pass opens (check / bet / call /
// fold). When the betting pass completes, the next draw round starts
// (or the declare / showdown phase).
//
// opts: { declare: boolean } — Paduki declares high/low/speak at the
// end; Straight High goes straight to showdown.

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
  table.current_bet = 0;
  for (const p of players) {
    p.round_paid = 0;
    p.acted = false;
  }
  const seat = firstActorSeat(players, Number(table.dealer_seat || 0));
  table.turn_user_id = seat === null ? '' : players[seat].user_id;
  table.turn_expires_at = seat === null ? '' : new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
}

function startDrawPass(table, players) {
  // Fresh betting state for the round that follows this draw: without
  // the reset, the stale bet/acted flags from the previous round make
  // the engine think the next betting pass is already complete and it
  // skips straight to the following draw.
  table.current_bet = 0;
  for (const p of players) {
    p.drawn = false;
    p.round_paid = 0;
    p.acted = false;
  }
  const seat = firstActorSeat(players, Number(table.dealer_seat || 0));
  table.turn_user_id = seat === null ? '' : players[seat].user_id;
  table.turn_expires_at = seat === null ? '' : new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
}

function startDeclarePhase(table, players) {
  table.phase = 'declare';
  const seat = firstActorSeat(players, Number(table.dealer_seat || 0));
  table.turn_user_id = seat === null ? '' : players[seat].user_id;
  table.turn_expires_at = seat === null ? '' : new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
}

// Advance after one player has acted. Returns 'continue' |
// 'last-standing' | 'showdown'. `opts.declare` decides whether the
// game declares after the final draw or goes straight to showdown.
export function advanceAfterDrawAction(table, players, actedSeat, opts) {
  const active = activePlayers(players);
  if (active.length <= 1) return 'last-standing';

  if (table.phase === 'declare') {
    const pending = active.filter((p) => !p.declared);
    if (pending.length === 0) return 'showdown';
    const n = players.length;
    let seat = null;
    for (let step = 1; step <= n; step++) {
      const s = (actedSeat + step) % n;
      if (!players[s].folded && !players[s].declared) {
        seat = s;
        break;
      }
    }
    if (seat === null) return 'showdown';
    table.turn_user_id = players[seat].user_id;
    table.turn_expires_at = new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
    return 'continue';
  }

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

  // Betting round complete — next draw, or the end of the hand.
  // reveal_round counts completed draws: 0 = draw 1 pending, 1 = draw
  // 2 pending, 2 = draw 3 pending. After the third draw's betting
  // pass there is no fourth draw.
  const round = Number(table.reveal_round || 0);
  if (round < 2) {
    table.reveal_round = round + 1;
    startDrawPass(table, players);
    return 'continue';
  }
  if (opts.declare) {
    startDeclarePhase(table, players);
    return 'continue';
  }
  return 'showdown';
}

// Apply one action for a seat in a 4-card draw game. Returns
// { outcome, error, newHand?, newDeck? }. `hand` is the acting
// player's current 4 cards, `deck` the undealt cards. When the action
// is a draw, newHand/newDeck carry the updated cards for the caller
// to persist (PokerHand row + deck row).
export function applyDrawGameAction(table, players, seat, action, declare, discards, hand, deck, opts) {
  const player = players[seat];
  if (!player) return { error: 'Seat not found.' };
  if (player.folded) return { error: 'You have folded.' };
  if (table.turn_user_id !== player.user_id) return { error: 'It is not your turn.' };

  const coin = table.coin;
  const betUnit = round(Number(table.bet_unit || 0), coin);

  if (table.phase === 'declare') {
    if (action !== 'declare') return { error: 'Declare high, low, or let the cards speak.' };
    if (!['high', 'low', 'speak'].includes(declare)) {
      return { error: 'Pick high, low, or cards speak.' };
    }
    if (player.declared) return { error: 'You already declared.' };
    player.declared = declare;
    const outcome = advanceAfterDrawAction(table, players, seat, opts);
    return { outcome };
  }

  if (table.phase !== 'betting') return { error: 'Betting is closed right now.' };

  // Draw pass.
  if (drawPassActive(players)) {
    if (action === 'fold') {
      player.folded = true;
      player.drawn = true;
      const outcome = advanceAfterDrawAction(table, players, seat, opts);
      return { outcome };
    }
    if (action !== 'draw') return { error: 'Draw your cards first — pick up to the allowed discards, or fold.' };
    const round = Number(table.reveal_round || 0);
    const limit = DRAW_LIMITS[round] ?? 1;
    const list = Array.isArray(discards) ? [...new Set(discards.map(Number))] : [];
    if (list.length > limit) return { error: `This draw you can throw back at most ${limit}.` };
    if (list.some((i) => !Number.isInteger(i) || i < 0 || i > 3)) {
      return { error: 'Pick the cards to throw back.' };
    }
    if (round === 2 && list.length !== 1) {
      return { error: 'The final draw you throw back exactly one card.' };
    }
    if (!hand || hand.length !== 4) return { error: 'Your hand is not ready.' };
    if (deck.length < list.length) return { error: 'Not enough cards left in the deck.' };
    const { hand: newHand, deck: newDeckCards } = applyDiscards(hand, list, deck);
    player.drawn = true;
    const outcome = advanceAfterDrawAction(table, players, seat, opts);
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
  const outcome = advanceAfterDrawAction(table, players, seat, opts);
  return { outcome };
}

// Timeout auto-action: stand pat in a draw pass, check if possible
// otherwise fold in a betting pass, cards speak in a declare phase.
export function applyTimeoutDrawAction(table, players, opts) {
  const seat = players.findIndex((p) => p.user_id === table.turn_user_id);
  if (seat < 0) return 'continue';
  const player = players[seat];
  if (player.folded) return 'continue';
  if (table.phase === 'declare') {
    if (!player.declared) player.declared = 'speak';
    return advanceAfterDrawAction(table, players, seat, opts);
  }
  if (drawPassActive(players)) {
    // Stand pat: draw nothing, move on.
    player.drawn = true;
    return advanceAfterDrawAction(table, players, seat, opts);
  }
  if (player.acted && Number(player.round_paid || 0) >= Number(table.current_bet || 0)) return 'continue';
  const currentBet = round(Number(table.current_bet || 0), table.coin);
  const paid = round(Number(player.round_paid || 0), table.coin);
  if (paid >= currentBet) {
    player.acted = true;
    return advanceAfterDrawAction(table, players, seat, opts);
  }
  player.folded = true;
  player.acted = true;
  return advanceAfterDrawAction(table, players, seat, opts);
}

export function advanceTimeoutsDraw(table, players, opts) {
  let changed = false;
  for (let i = 0; i < 10; i++) {
    if (table.status !== 'in_play') break;
    if (!table.turn_expires_at) break;
    if (Date.now() <= new Date(table.turn_expires_at).getTime()) break;
    const outcome = applyTimeoutDrawAction(table, players, opts);
    changed = true;
    if (outcome !== 'continue') {
      table._pendingOutcome = outcome;
      break;
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Settlement for 4-card draw games
// ---------------------------------------------------------------------------
//
// opts: { highOnly: boolean, gameLabel: string }
// - highOnly (Straight High): the best high hand takes the whole pot.
// - otherwise (Paduki): the pot splits between the best high hand and
//   the best low hand among players who declared that way (or let the
//   cards speak). A direction with no winners gives its half to the
//   other direction.
export async function settleDrawGame(base44, table, players, mode, lastStandingUserId, opts = {}) {
  const coin = table.coin;
  // Play-money tables settle in chips only: no house fee, no wallet
  // moves, no ledger entries. Real-money tables settle exactly as before.
  const playMoney = opts.playMoney === true;
  const stake = round(Number(table.stake || 0), coin);
  const handsByUser = await getTableHands(base44, table.id);

  for (const p of players) {
    const hand = handsByUser[p.user_id] || [];
    if (hand.length === 4 && !p.folded) {
      p.best_high = evaluateHigh4(hand);
      p.best_low = evaluateLow4(hand);
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
  } else if (opts.highOnly) {
    const active = activePlayers(players);
    const pool = active.filter((p) => p.best_high);
    let best = null;
    for (const p of pool) {
      if (!best || compareHigh4(p.best_high, best.best_high) > 0) best = p;
    }
    const highWinners = best ? pool.filter((p) => compareHigh4(p.best_high, best.best_high) === 0) : [];
    winners.high = highWinners.map((p) => p.user_id);
    if (highWinners.length) {
      const each = round(distributable / highWinners.length, coin);
      highWinners.forEach((p, i) => {
        const share = i === 0 ? round(distributable - each * (highWinners.length - 1), coin) : each;
        shares[p.user_id] = round((shares[p.user_id] || 0) + share, coin);
      });
    }
    note = `High: ${highWinners.map((p) => p.handle).join(', ') || '—'}`;
  } else {
    const active = activePlayers(players);
    const eligibleHigh = active.filter((p) => ['high', 'speak'].includes(p.declared));
    const eligibleLow = active.filter((p) => ['low', 'speak'].includes(p.declared));

    let bestHigh = null;
    for (const p of eligibleHigh) {
      if (p.best_high && (!bestHigh || compareHigh4(p.best_high, bestHigh.best_high) > 0)) bestHigh = p;
    }
    let bestLow = null;
    for (const p of eligibleLow) {
      if (p.best_low && (!bestLow || compareLow4(p.best_low, bestLow.best_low) > 0)) bestLow = p;
    }
    const highWinners = bestHigh
      ? eligibleHigh.filter((p) => p.best_high && compareHigh4(p.best_high, bestHigh.best_high) === 0)
      : [];
    const lowWinners = bestLow
      ? eligibleLow.filter((p) => p.best_low && compareLow4(p.best_low, bestLow.best_low) === 0)
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
        description: win > 0 ? `${opts.gameLabel} win · ${table.title}` : `${opts.gameLabel} · ${table.title}`,
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
            declared: p.declared,
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

// ── Bot players (play-money tables only) ──────────────────────────────
// Same contract as Bone Crusher: bots act through
// applyDrawGameAction, are labelled is_bot, and never touch wallets,
// fees or ledgers. One shared implementation serves both Paduki
// (declare) and Straight High (high only) via `opts`.

// A bot's discards in a 4-card draw game: throw back every card that
// shares a suit with a higher card (a made hand needs one of each
// suit), lowest first, up to the round's limit. On the final draw the
// rules demand exactly one discard, so a bot with a made hand throws
// its lowest card.
export function drawGameBotDiscards(hand, limit, mustDiscardOne) {
  const bySuit = new Map();
  hand.forEach((card, i) => {
    const suit = suitOf(card);
    if (!bySuit.has(suit)) bySuit.set(suit, []);
    bySuit.get(suit).push(i);
  });
  const candidates = [];
  for (const idxs of bySuit.values()) {
    if (idxs.length > 1) {
      const sorted = [...idxs].sort((a, b) => rankValue(hand[a]) - rankValue(hand[b]));
      candidates.push(...sorted.slice(0, -1)); // keep the highest card of the suit
    }
  }
  candidates.sort((a, b) => rankValue(hand[a]) - rankValue(hand[b]));
  const discards = candidates.slice(0, limit);
  if (mustDiscardOne && discards.length === 0) {
    // No duplicate suit: throw the lowest card to satisfy the rule.
    let lowest = 0;
    hand.forEach((card, i) => {
      if (rankValue(card) < rankValue(hand[lowest])) lowest = i;
    });
    discards.push(lowest);
  }
  return discards;
}

function drawGameBotHandStrong(hand, declareGame) {
  if (!isMade4(hand)) return false;
  const high = evaluateHigh4(hand);
  if (high && high.category >= 1) return true;
  if (!declareGame) return false;
  const low = evaluateLow4(hand);
  return !!low && low.score[0] <= 5;
}

function drawGameBotDeclare(hand) {
  const high = evaluateHigh4(hand);
  const low = evaluateLow4(hand);
  const highStrong = high && high.category >= 1;
  const lowStrong = low && low.score[0] <= 5;
  if (highStrong && !lowStrong) return 'high';
  if (lowStrong && !highStrong) return 'low';
  return 'speak';
}

export function chooseBotMoveDrawGame(table, players, seat, hand, opts = {}) {
  const player = players[seat];
  if (table.phase === 'declare') {
    return { action: 'declare', declare: drawGameBotDeclare(hand || []) };
  }
  if (drawPassActive(players)) {
    const round = Number(table.reveal_round || 0);
    return {
      action: 'draw',
      discards: drawGameBotDiscards(hand || [], DRAW_LIMITS[round] ?? 1, round === DRAW_LIMITS.length - 1),
    };
  }
  return { action: chooseBettingMove(table, player, drawGameBotHandStrong(hand || [], opts.declare)) };
}

// Apply bot moves while the turn belongs to a bot. The bot's hand and
// the undealt deck are read fresh from their PokerHand rows on every
// bot turn, so a bot always draws from the current deck; a bot draw is
// persisted to the same rows the human draw uses, and `handsByUser`
// is kept in sync for the caller. Returns the hand outcome.
export async function driveDrawGameBotTurns(base44, table, players, handsByUser, opts = {}) {
  return driveBotTurns(table, players, async (t, ps, seat) => {
    const player = ps[seat];
    const handRow = await getHandRow(base44, t.id, player.user_id);
    const deckRow = await getDeckRow(base44, t.id);
    const hand = handRow ? handRow.cards : [];
    const deck = deckRow ? deckRow.cards : [];
    const move = chooseBotMoveDrawGame(t, ps, seat, hand, opts);
    const result = applyDrawGameAction(t, ps, seat, move.action, move.declare || '', move.discards || [], hand, deck, opts);
    if (result.error) return 'error';
    if (result.newHand && handRow) {
      await base44.asServiceRole.entities.PokerHand.update(handRow.id, {
        cards_json: JSON.stringify(result.newHand),
      });
      handsByUser[player.user_id] = result.newHand;
    }
    if (result.newDeck && deckRow) await saveDeckRow(base44, deckRow.id, result.newDeck);
    return result.outcome;
  });
}

// Deal a 4-card draw hand: deal 4 cards each and stash the rest of
// the deck, then flip the table to in_play with the first draw pass
// open. This mirrors the Deal button (start entries for Paduki and
// Straight High) exactly — it is shared by the start entries and the
// bot auto-deal in getState.
export async function dealDrawGameHand(base44, table, players) {
  await dealDrawHands(base44, table, players);

  for (const p of players) {
    p.drawn = false;
    p.round_paid = 0;
    p.acted = false;
  }

  const firstSeat = firstActorSeat(players, Number(table.dealer_seat || 0));
  const updated = await base44.asServiceRole.entities.PokerTable.update(table.id, {
    status: 'in_play',
    phase: 'betting',
    reveal_round: 0,
    current_bet: 0,
    pot: 0,
    players_json: JSON.stringify(players),
    turn_user_id: firstSeat === null ? '' : players[firstSeat].user_id,
    turn_expires_at:
      firstSeat === null ? '' : new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString(),
    version: Number(table.version || 0) + 1,
  });
  return updated;
}
