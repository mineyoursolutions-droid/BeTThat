// Bone Crusher ("Kick Two Roll One") — Chain Gang poker.
// Shared server-side engine: deck + shuffle, 5-card hand evaluation
// (standard high + ace-to-five low), best-5-of-7, the betting/declare
// state machine, and settlement with the swing rule.
//
// Rules (the user's own):
// - Max 5 players. Each is dealt 7 cards: 3 down, 4 up. The 4 up-cards
//   are turned over one at a time, one betting round per revealed card.
// - Declare, in turn order after the 4th up-card: high, low, swing
//   (both), or let the cards speak.
// - At showdown each player makes their best 5-card hand from their 7
//   (throw two back). The pot splits between the best high hand and
//   the best low hand (ace-to-five: A-2-3-4-5 is the best low hand).
// - Swing: a swinger must have the best hand in BOTH directions. If
//   anyone beats them in either direction they automatically lose
//   everything, even a half they won.
//
// Card codes are two characters: rank + suit, e.g. "As", "Kd", "Qh",
// "Jc", "Ts", "9h". Ranks: 2-9, T, J, Q, K, A. Suits: s, h, d, c.
// A player's hand is laid out [down, down, down, up, up, up, up]:
// reveal round r (1-4) turns over hand[2 + r].

import { HOUSE_FEE, round, moveFunds, recordLedger } from './wallet.ts';

export const ACTION_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';

export function newDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) deck.push(`${r}${s}`);
  }
  return deck;
}

function randomBelow(n) {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  } catch {
    return Math.floor(Math.random() * n);
  }
}

export function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export const rankValue = (card) => RANKS.indexOf(card[0]) + 2; // 2..14 (A=14)
export const suitOf = (card) => card[1];
export const rankLabel = (card) => (card[0] === 'T' ? '10' : card[0]);

// ---------------------------------------------------------------------------
// High-hand evaluation (standard 5-card poker)
// ---------------------------------------------------------------------------

function evaluateHigh5(cards) {
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const distinct = [...new Set(values)].sort((a, b) => b - a);
  let straightHigh = 0;
  if (distinct.length === 5) {
    if (distinct[0] - distinct[4] === 4) straightHigh = distinct[0];
    else if (distinct[0] === 14 && distinct[1] === 5) straightHigh = 5; // wheel A-2-3-4-5
  }

  // Group ranks by count, groups sorted by (count desc, rank desc).
  const groups = [];
  for (const v of distinct) {
    groups.push({ rank: v, count: values.filter((x) => x === v).length });
  }
  groups.sort((a, b) => b.count - a.count || b.rank - a.rank);
  const counts = groups.map((g) => g.count);

  const label = (v) => (v === 14 ? 'A' : v === 13 ? 'K' : v === 12 ? 'Q' : v === 11 ? 'J' : String(v));

  if (straightHigh && flush) return { category: 8, tiebreak: [straightHigh], name: 'Straight Flush', cards };
  if (counts[0] === 4) return { category: 7, tiebreak: [groups[0].rank, groups[1].rank], name: 'Four of a Kind', cards };
  if (counts[0] === 3 && counts[1] === 2)
    return { category: 6, tiebreak: [groups[0].rank, groups[1].rank], name: 'Full House', cards };
  if (flush) return { category: 5, tiebreak: values, name: 'Flush', cards };
  if (straightHigh)
    return { category: 4, tiebreak: [straightHigh], name: `Straight · ${label(straightHigh)} high`, cards };
  if (counts[0] === 3)
    return {
      category: 3,
      tiebreak: [groups[0].rank, ...groups.slice(1).map((g) => g.rank)],
      name: 'Three of a Kind',
      cards,
    };
  if (counts[0] === 2 && counts[1] === 2)
    return {
      category: 2,
      tiebreak: [groups[0].rank, groups[1].rank, groups[2].rank],
      name: 'Two Pair',
      cards,
    };
  if (counts[0] === 2)
    return {
      category: 1,
      tiebreak: [groups[0].rank, ...groups.slice(1).map((g) => g.rank)],
      name: `Pair of ${label(groups[0].rank)}s`,
      cards,
    };
  return { category: 0, tiebreak: values, name: `High Card ${label(values[0])}`, cards };
}

// Compare two high evaluations: 1 if a wins, -1 if b wins, 0 if tied.
export function compareHigh(a, b) {
  if (a.category !== b.category) return a.category > b.category ? 1 : -1;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const x = a.tiebreak[i] || 0;
    const y = b.tiebreak[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Low-hand evaluation (ace-to-five: straights and flushes are ignored,
// lowest cards win; A-2-3-4-5, the wheel, is the best possible low hand)
// ---------------------------------------------------------------------------

function lowScore5(cards) {
  // Descending rank values with A=1; lower lexicographic score wins.
  return cards
    .map((c) => (rankValue(c) === 14 ? 1 : rankValue(c)))
    .sort((a, b) => b - a);
}

// Compare two low hands (bestLow7 results, or raw score arrays): 1 if
// a wins (lower), -1 if b wins, 0 if tied.
export function compareLow(a, b) {
  const sa = a.score || a;
  const sb = b.score || b;
  for (let i = 0; i < 5; i++) {
    if (sa[i] !== sb[i]) return sa[i] < sb[i] ? 1 : -1;
  }
  return 0;
}

function lowName(score) {
  if (score.join(',') === '5,4,3,2,1') return 'Wheel · A-2-3-4-5';
  const top = score[0];
  const label = top === 1 ? 'A' : String(top);
  return `${label}-low`;
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

// Best 5-card high hand out of 7 (throw two back).
export function bestHigh7(cards7) {
  let best = null;
  for (const combo of combinations(cards7, 5)) {
    const ev = evaluateHigh5(combo);
    if (!best || compareHigh(ev, best) > 0) best = ev;
  }
  return best;
}

// Best 5-card low hand out of 7 (ace-to-five).
export function bestLow7(cards7) {
  let best = null;
  for (const combo of combinations(cards7, 5)) {
    const score = lowScore5(combo);
    if (!best || compareLow(score, best.score) > 0) best = { score, cards: combo, name: lowName(score) };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Table state helpers (players live in PokerTable.players_json)
// ---------------------------------------------------------------------------

export function playersOf(table) {
  try {
    return JSON.parse(table.players_json || '[]');
  } catch {
    return [];
  }
}

export const activePlayers = (players) => players.filter((p) => !p.folded);

export function needsAction(player, currentBet) {
  return !player.folded && (!player.acted || Number(player.round_paid || 0) < Number(currentBet || 0));
}

export function nextActorSeat(players, fromSeat, currentBet) {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const seat = (fromSeat + step) % n;
    if (needsAction(players[seat], currentBet)) return seat;
  }
  return null;
}

export function firstActorSeat(players, dealerSeat) {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const seat = (dealerSeat + step) % n;
    if (!players[seat].folded) return seat;
  }
  return null;
}

export function newPlayerState({ userId, handle, seat, stake }) {
  return {
    user_id: userId,
    handle,
    seat,
    stack: stake,
    contributed: 0,
    round_paid: 0,
    folded: false,
    acted: false,
    declared: null,
    up_cards: [],
    best_high: null,
    best_low: null,
    result: null,
  };
}

// ---------------------------------------------------------------------------
// Turn / round transitions (pure: mutate the in-memory table + players)
// ---------------------------------------------------------------------------

function resetBettingRound(table, players) {
  table.current_bet = 0;
  for (const p of players) {
    p.round_paid = 0;
    p.acted = false;
  }
  const seat = firstActorSeat(players, Number(table.dealer_seat || 0));
  table.turn_user_id = seat === null ? '' : players[seat].user_id;
  table.turn_expires_at = seat === null ? '' : new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
}

// Reveal the next up-card for every active player. hand layout is
// [down, down, down, up, up, up, up]; reveal round r turns over hand[2+r].
function revealNextCard(table, players, handsByUser) {
  const round = Number(table.reveal_round || 0);
  for (const p of players) {
    if (p.folded) continue;
    const hand = handsByUser[p.user_id];
    if (!hand || !hand[2 + round]) continue;
    p.up_cards = [...(p.up_cards || []), hand[2 + round]];
  }
}

// Advance the game after one player has acted. Returns
// 'continue' | 'last-standing' | 'showdown'. When the betting round
// completes it either reveals the next card or moves to the declare
// phase; when the declare phase completes it moves to showdown.
export function advanceAfterAction(table, players, actedSeat, handsByUser) {
  const active = activePlayers(players);
  if (active.length <= 1) return 'last-standing';
  if (table.phase === 'declare') {
    const pending = active.filter((p) => !p.declared);
    if (pending.length === 0) return 'showdown';
    // Next declarer in seat order after the player who just declared.
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

  const next = nextActorSeat(players, actedSeat, Number(table.current_bet || 0));
  if (next !== null) {
    table.turn_user_id = players[next].user_id;
    table.turn_expires_at = new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
    return 'continue';
  }

  // Betting round complete.
  if (Number(table.reveal_round || 0) < 4) {
    table.reveal_round = Number(table.reveal_round || 0) + 1;
    revealNextCard(table, players, handsByUser);
    resetBettingRound(table, players);
    return 'continue';
  }

  // All four up-cards are out — on to the declare phase.
  table.phase = 'declare';
  const seat = firstActorSeat(players, Number(table.dealer_seat || 0));
  table.turn_user_id = seat === null ? '' : players[seat].user_id;
  table.turn_expires_at = seat === null ? '' : new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
  return 'continue';
}

// Apply one action for a seat. Validates turn and action, moves chips,
// and advances the game. Returns { outcome, error }.
export function applyPlayerAction(table, players, seat, action, declare, handsByUser = {}) {
  const player = players[seat];
  if (!player) return { error: 'Seat not found.' };
  if (player.folded) return { error: 'You have folded.' };
  if (table.turn_user_id !== player.user_id) return { error: 'It is not your turn.' };

  const coin = table.coin;
  const betUnit = round(Number(table.bet_unit || 0), coin);

  if (table.phase === 'declare') {
    if (action !== 'declare') return { error: 'Declare high, low, swing, or let the cards speak.' };
    if (!['high', 'low', 'swing', 'speak'].includes(declare)) {
      return { error: 'Pick high, low, swing, or cards speak.' };
    }
    if (player.declared) return { error: 'You already declared.' };
    player.declared = declare;
    const outcome = advanceAfterAction(table, players, seat, handsByUser);
    return { outcome };
  }

  if (table.phase !== 'betting') return { error: 'Betting is closed right now.' };
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
  const outcome = advanceAfterAction(table, players, seat, handsByUser);
  return { outcome };
}

// Timeout auto-action for the player whose clock ran out: check if
// possible, otherwise fold; in the declare phase the cards speak.
export function applyTimeoutAction(table, players, handsByUser = {}) {
  const seat = players.findIndex((p) => p.user_id === table.turn_user_id);
  if (seat < 0) return 'continue';
  const player = players[seat];
  if (player.folded) return 'continue';
  if (table.phase === 'declare') {
    if (!player.declared) player.declared = 'speak';
    return advanceAfterAction(table, players, seat, handsByUser);
  }
  if (player.acted && Number(player.round_paid || 0) >= Number(table.current_bet || 0)) return 'continue';
  const currentBet = round(Number(table.current_bet || 0), table.coin);
  const paid = round(Number(player.round_paid || 0), table.coin);
  if (paid >= currentBet) {
    player.acted = true;
    return advanceAfterAction(table, players, seat, handsByUser);
  }
  player.folded = true;
  player.acted = true;
  return advanceAfterAction(table, players, seat, handsByUser);
}

// Apply every expired turn in sequence (a table can only ever need one
// auto-action per poll, but loop defensively). Returns true if the
// state changed.
export function advanceTimeouts(table, players, handsByUser = {}) {
  let changed = false;
  for (let i = 0; i < 10; i++) {
    if (table.status !== 'in_play') break;
    if (!table.turn_expires_at) break;
    if (Date.now() <= new Date(table.turn_expires_at).getTime()) break;
    const outcome = applyTimeoutAction(table, players, handsByUser);
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

async function asRows(promise) {
  const res = await promise;
  if (Array.isArray(res)) return res;
  return (res && res.items) || [];
}

export async function getTableHands(base44, tableId) {
  const rows = await asRows(base44.asServiceRole.entities.PokerHand.filter({ table_id: tableId }, { limit: 10 }));
  const byUser = {};
  for (const row of rows) {
    try {
      byUser[row.user_id] = JSON.parse(row.cards_json || '[]');
    } catch {
      byUser[row.user_id] = [];
    }
  }
  return byUser;
}

// Settle a finished hand: evaluate every active player's best 5-card
// high and low hands, apply the swing rule, split the pot (5% house
// fee), return unspent chips, and write the settled state. mode is
// 'showdown' or 'last-standing' (everyone else folded).
export async function settleBoneCrusher(base44, table, players, mode, lastStandingUserId, opts = {}) {
  const coin = table.coin;
  // Play-money tables settle in chips only: no house fee, no wallet
  // moves, no ledger entries. Real-money tables settle exactly as
  // before (5% fee, escrow payout).
  const playMoney = opts.playMoney === true;
  const stake = round(Number(table.stake || 0), coin);
  const handsByUser = await getTableHands(base44, table.id);

  // Evaluate hands for the showdown display (and for winners).
  for (const p of players) {
    const hand = handsByUser[p.user_id] || [];
    if (hand.length === 7 && !p.folded) {
      p.best_high = bestHigh7(hand);
      p.best_low = bestLow7(hand);
    }
  }

  const pot = round(
    players.reduce((sum, p) => sum + Number(p.contributed || 0), 0),
    coin,
  );
  const fee = playMoney ? 0 : round(pot * HOUSE_FEE, coin);
  const distributable = round(pot - fee, coin);

  // shares[user_id] = winnings from the pot (before unspent-stack return)
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
    const eligibleHigh = active.filter((p) => ['high', 'swing', 'speak'].includes(p.declared));
    const eligibleLow = active.filter((p) => ['low', 'swing', 'speak'].includes(p.declared));

    // Best hand per direction among the eligible, with swingers
    // disqualified from BOTH directions if anyone beats them in either
    // one (they must win both or lose everything).
    const disqualified = new Set();
    let highWinners = [];
    let lowWinners = [];
    for (let pass = 0; pass < 5; pass++) {
      const highPool = eligibleHigh.filter((p) => !disqualified.has(p.user_id) && p.best_high);
      const lowPool = eligibleLow.filter((p) => !disqualified.has(p.user_id) && p.best_low);
      let bestHigh = null;
      for (const p of highPool) {
        if (!bestHigh || compareHigh(p.best_high, bestHigh.best_high) > 0) bestHigh = p;
      }
      let bestLow = null;
      for (const p of lowPool) {
        if (!bestLow || compareLow(p.best_low, bestLow.best_low) > 0) bestLow = p;
      }
      highWinners = bestHigh ? highPool.filter((p) => compareHigh(p.best_high, bestHigh.best_high) === 0) : [];
      lowWinners = bestLow ? lowPool.filter((p) => compareLow(p.best_low, bestLow.best_low) === 0) : [];

      // A swinger who wins one direction but not the other is out of both.
      const newlyOut = [];
      for (const p of [...highWinners, ...lowWinners]) {
        if (p.declared !== 'swing') continue;
        const winsHigh = highWinners.some((w) => w.user_id === p.user_id);
        const winsLow = lowWinners.some((w) => w.user_id === p.user_id);
        if (winsHigh !== winsLow) newlyOut.push(p.user_id);
      }
      if (newlyOut.length === 0) break;
      newlyOut.forEach((id) => disqualified.add(id));
    }

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
    if (disqualified.size) {
      const names = [...disqualified]
        .map((id) => (players.find((p) => p.user_id === id) || {}).handle || 'A swinger')
        .join(', ');
      note += ` · ${names} swung and lost it all`;
    }
  }

  // Pay out: unspent stack back + winnings. Losers' escrowed buy-in
  // funds the pot; the 5% fee is retained by the house (same as
  // settlePot — the fee is simply never credited out). On a play-money
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
        description: win > 0 ? `Bone Crusher win · ${table.title}` : `Bone Crusher · ${table.title}`,
        balanceAfter: wallet.available,
        refId: table.id,
      });
    }
    p.result = {
      won_high: winners.high.includes(p.user_id),
      won_low: winners.low.includes(p.user_id),
      winnings: win,
      credit,
      swung_out: mode === 'showdown' && p.declared === 'swing' && !winners.high.includes(p.user_id) && !winners.low.includes(p.user_id),
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
            up_cards: p.up_cards || [],
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
