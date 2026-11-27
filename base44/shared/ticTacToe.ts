// Tic Tac Toe — Chain Gang poker.
//
// Rules (the user's own):
// - Each player is dealt 9 cards in a 3x3 grid: top row, middle row,
//   bottom row (3 cards each).
// - A hand is any tic-tac-toe line of three touching cards: the three
//   rows, the three columns (north to south), and the two diagonals.
//   The player plays their BEST line — best high hand or best low hand.
// - Played high or low: each player declares high / low / swing / cards
//   speak (Bone Crusher-style default — the user hasn't said whether
//   each player picks or the table plays one way).
// - One betting round after the deal (bet per round = buy-in / 10),
//   then declare, then showdown. The pot splits between the best high
//   line and the best low line (ace-to-five: A-2-3 is the best low line).
// - Swing: a swinger must have the best hand in BOTH directions. If
//   anyone beats them in either direction they automatically lose
//   everything, even a half they won.
//
// Card codes are two characters: rank + suit, e.g. "As", "Kd", "Qh".
// A player's grid is their 9 dealt cards in row-major order:
//   0 1 2
//   3 4 5
//   6 7 8

import { HOUSE_FEE, round, moveFunds, recordLedger } from './wallet.ts';
import {
  ACTION_TIMEOUT_MS,
  activePlayers,
  chooseBettingMove,
  driveBotTurns,
  firstActorSeat,
  getTableHands,
  newDeck,
  newPlayerState,
  nextActorSeat,
  playersOf,
  rankValue,
  shuffleDeck,
  suitOf,
} from './poker.ts';

export const TIC_TAC_TOE_MAX_PLAYERS = 5;

// The eight tic-tac-toe lines (indices into the 3x3 grid).
export const TTT_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const LINE_NAMES = [
  'Top row',
  'Middle row',
  'Bottom row',
  'Left column',
  'Middle column',
  'Right column',
  'Diagonal \\',
  'Diagonal /',
];

// ---------------------------------------------------------------------------
// 3-card hand evaluation
// ---------------------------------------------------------------------------

function straightHigh3(values) {
  // values: 3 distinct rank values sorted desc. Returns the straight's
  // high card (3 for the A-2-3 wheel) or 0.
  if (values.length !== 3) return 0;
  if (values[0] - values[2] === 2) return values[0];
  if (values[0] === 14 && values[1] === 3 && values[2] === 2) return 3; // A-2-3 wheel
  return 0;
}

const rankLabel = (v) => (v === 14 ? 'A' : v === 13 ? 'K' : v === 12 ? 'Q' : v === 11 ? 'J' : String(v));

export function evaluateHigh3(cards) {
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  const distinct = [...new Set(values)].sort((a, b) => b - a);
  const straight = straightHigh3(distinct);

  if (straight && flush)
    return { category: 5, tiebreak: [straight], name: `Straight Flush · ${rankLabel(straight)} high`, cards };
  if (distinct.length === 1)
    return { category: 4, tiebreak: [values[0]], name: `Three ${rankLabel(values[0])}s`, cards };
  if (straight)
    return { category: 3, tiebreak: [straight], name: `Straight · ${rankLabel(straight)} high`, cards };
  if (flush) return { category: 2, tiebreak: values, name: 'Flush', cards };
  if (distinct.length === 2) {
    const pairRank = values[0] === values[1] ? values[0] : values[1];
    const kicker = values.find((v) => v !== pairRank);
    return { category: 1, tiebreak: [pairRank, kicker], name: `Pair of ${rankLabel(pairRank)}s`, cards };
  }
  return { category: 0, tiebreak: values, name: `High Card ${rankLabel(values[0])}`, cards };
}

// Compare two 3-card high evaluations: 1 if a wins, -1 if b wins, 0 if tied.
export function compareHigh3(a, b) {
  if (a.category !== b.category) return a.category > b.category ? 1 : -1;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const x = a.tiebreak[i] || 0;
    const y = b.tiebreak[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// Low 3-card line (ace-to-five: straights and flushes ignored, lowest
// cards win; A-2-3 is the best possible low line). Score is the
// descending rank values with A=1; lower lexicographic score wins.
function lowScore3(cards) {
  return cards.map((c) => (rankValue(c) === 14 ? 1 : rankValue(c))).sort((a, b) => b - a);
}

export function compareLow3(a, b) {
  const sa = a.score || a;
  const sb = b.score || b;
  for (let i = 0; i < 3; i++) {
    if (sa[i] !== sb[i]) return sa[i] < sb[i] ? 1 : -1;
  }
  return 0;
}

function lowName3(score) {
  if (score.join(',') === '3,2,1') return 'Wheel · A-2-3';
  return `${score[0] === 1 ? 'A' : score[0]}-low`;
}

// Best 3-card high line out of the 3x3 grid.
export function bestHighLine(grid9) {
  let best = null;
  TTT_LINES.forEach((line, i) => {
    const cards = line.map((idx) => grid9[idx]);
    const ev = evaluateHigh3(cards);
    if (!best || compareHigh3(ev, best.ev) > 0) best = { ev, line: LINE_NAMES[i], cards };
  });
  return best ? { ...best.ev, line: best.line } : null;
}

// Best 3-card low line out of the 3x3 grid.
export function bestLowLine(grid9) {
  let best = null;
  TTT_LINES.forEach((line, i) => {
    const cards = line.map((idx) => grid9[idx]);
    const score = lowScore3(cards);
    if (!best || compareLow3(score, best.score) > 0)
      best = { score, line: LINE_NAMES[i], cards, name: lowName3(score) };
  });
  return best;
}

// ---------------------------------------------------------------------------
// Table state machine (one betting round, then declare, then showdown)
// ---------------------------------------------------------------------------

// Advance after one player has acted. Returns 'continue' |
// 'last-standing' | 'showdown'.
export function advanceAfterActionTTT(table, players, actedSeat) {
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

  const next = nextActorSeat(players, actedSeat, Number(table.current_bet || 0));
  if (next !== null) {
    table.turn_user_id = players[next].user_id;
    table.turn_expires_at = new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
    return 'continue';
  }

  // Betting round complete — on to the declare phase.
  table.phase = 'declare';
  const seat = firstActorSeat(players, Number(table.dealer_seat || 0));
  table.turn_user_id = seat === null ? '' : players[seat].user_id;
  table.turn_expires_at = seat === null ? '' : new Date(Date.now() + ACTION_TIMEOUT_MS).toISOString();
  return 'continue';
}

// Apply one action for a seat. Returns { outcome, error }.
export function applyTicTacToeAction(table, players, seat, action, declare) {
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
    const outcome = advanceAfterActionTTT(table, players, seat);
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
  const outcome = advanceAfterActionTTT(table, players, seat);
  return { outcome };
}

// Timeout auto-action: check if possible, otherwise fold; in the
// declare phase the cards speak.
export function applyTimeoutActionTTT(table, players) {
  const seat = players.findIndex((p) => p.user_id === table.turn_user_id);
  if (seat < 0) return 'continue';
  const player = players[seat];
  if (player.folded) return 'continue';
  if (table.phase === 'declare') {
    if (!player.declared) player.declared = 'speak';
    return advanceAfterActionTTT(table, players, seat);
  }
  if (player.acted && Number(player.round_paid || 0) >= Number(table.current_bet || 0)) return 'continue';
  const currentBet = round(Number(table.current_bet || 0), table.coin);
  const paid = round(Number(player.round_paid || 0), table.coin);
  if (paid >= currentBet) {
    player.acted = true;
    return advanceAfterActionTTT(table, players, seat);
  }
  player.folded = true;
  player.acted = true;
  return advanceAfterActionTTT(table, players, seat);
}

export function advanceTimeoutsTTT(table, players) {
  let changed = false;
  for (let i = 0; i < 10; i++) {
    if (table.status !== 'in_play') break;
    if (!table.turn_expires_at) break;
    if (Date.now() <= new Date(table.turn_expires_at).getTime()) break;
    const outcome = applyTimeoutActionTTT(table, players);
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

// Settle a finished hand: evaluate every active player's best 3-card
// high and low lines, apply the swing rule, split the pot (5% house
// fee), return unspent chips, and write the settled state. mode is
// 'showdown' or 'last-standing'.
export async function settleTicTacToe(base44, table, players, mode, lastStandingUserId, opts = {}) {
  const coin = table.coin;
  // Play-money tables settle in chips only: no house fee, no wallet
  // moves, no ledger entries. Real-money tables settle exactly as before.
  const playMoney = opts.playMoney === true;
  const stake = round(Number(table.stake || 0), coin);
  const handsByUser = await getTableHands(base44, table.id);

  for (const p of players) {
    const hand = handsByUser[p.user_id] || [];
    if (hand.length === 9 && !p.folded) {
      p.best_high = bestHighLine(hand);
      p.best_low = bestLowLine(hand);
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
    const eligibleHigh = active.filter((p) => ['high', 'swing', 'speak'].includes(p.declared));
    const eligibleLow = active.filter((p) => ['low', 'swing', 'speak'].includes(p.declared));

    // Best line per direction among the eligible, with swingers
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
        if (!bestHigh || compareHigh3(p.best_high, bestHigh.best_high) > 0) bestHigh = p;
      }
      let bestLow = null;
      for (const p of lowPool) {
        if (!bestLow || compareLow3(p.best_low, bestLow.best_low) > 0) bestLow = p;
      }
      highWinners = bestHigh ? highPool.filter((p) => compareHigh3(p.best_high, bestHigh.best_high) === 0) : [];
      lowWinners = bestLow ? lowPool.filter((p) => compareLow3(p.best_low, bestLow.best_low) === 0) : [];

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
        description: win > 0 ? `Tic Tac Toe win · ${table.title}` : `Tic Tac Toe · ${table.title}`,
        balanceAfter: wallet.available,
        refId: table.id,
      });
    }
    p.result = {
      won_high: winners.high.includes(p.user_id),
      won_low: winners.low.includes(p.user_id),
      winnings: win,
      credit,
      swung_out:
        mode === 'showdown' &&
        p.declared === 'swing' &&
        !winners.high.includes(p.user_id) &&
        !winners.low.includes(p.user_id),
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
// applyTicTacToeAction, are labelled is_bot, and never touch wallets,
// fees or ledgers.

function tttBotHandStrong(hand) {
  const high = bestHighLine(hand);
  const low = bestLowLine(hand);
  return (high && high.category >= 1) || (low && low.score[0] <= 4);
}

function tttBotDeclare(hand) {
  const high = bestHighLine(hand);
  const low = bestLowLine(hand);
  const highStrong = high && high.category >= 2;
  const lowStrong = low && low.score[0] <= 4;
  const highWeak = !high || high.category === 0;
  const lowWeak = !low || low.score[0] >= 8;
  if (highStrong && lowWeak) return 'high';
  if (lowStrong && highWeak) return 'low';
  return 'speak';
}

export function chooseBotMoveTicTacToe(table, players, seat, hand) {
  const player = players[seat];
  if (table.phase === 'declare') {
    return { action: 'declare', declare: tttBotDeclare(hand || []) };
  }
  return { action: chooseBettingMove(table, player, tttBotHandStrong(hand || [])) };
}

export async function driveTicTacToeBotTurns(base44, table, players, handsByUser) {
  return driveBotTurns(table, players, async (t, ps, seat) => {
    const player = ps[seat];
    const move = chooseBotMoveTicTacToe(t, ps, seat, handsByUser[player.user_id] || []);
    const result = applyTicTacToeAction(t, ps, seat, move.action, move.declare || '');
    if (result.error) return 'error';
    return result.outcome;
  });
}

// Deal a Tic Tac Toe hand: shuffle, deal 9 cards per player into the
// 3x3 grid, create the private hand rows, and flip the table to
// in_play on the single betting round. The grid stays private — it is
// NOT copied into up_cards (up_cards is public). This mirrors the
// Deal button (start entry) exactly — it is shared by the start entry
// and the bot auto-deal in getState.
export async function dealTicTacToeHand(base44, table, players) {
  const deck = shuffleDeck(newDeck());
  const handsByUser = {};
  for (let i = 0; i < players.length; i++) {
    const hand = deck.slice(i * 9, i * 9 + 9);
    handsByUser[players[i].user_id] = hand;
    await base44.asServiceRole.entities.PokerHand.create({
      table_id: table.id,
      user_id: players[i].user_id,
      cards_json: JSON.stringify(hand),
    });
  }

  for (const p of players) {
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
