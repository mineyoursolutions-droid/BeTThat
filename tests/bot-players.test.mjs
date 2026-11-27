// Bot players for Chain Gang Poker.
//
// Run with: npm test   (node --test, no extra dependencies)
// These tests run the real shared server code (base44/shared/*.ts)
// against a fake Base44 client — no network, no database.
//
// What is covered:
// - Bots seat on a 1-human play-money lobby table and the hand starts.
// - Bots never seat on a real-money table.
// - A joining human displaces a bot; bots leave when the last human leaves.
// - Bot moves are legal per game and full hands settle, with virtual
//   chips only (no fee, no wallet, no ledger entries) and the chips
//   conserved across the table.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  seatBots,
  displaceBotForHuman,
  removeBotsWhenNoHumans,
  botGraceExpired,
  makeBotPlayer,
  humanPlayers,
  botPlayers,
  BOT_TARGET_PLAYERS,
  BOT_GRACE_MS,
} from '../base44/shared/bots.ts';
import {
  playersOf,
  newPlayerState,
  activePlayers,
  getTableHands,
  settleBoneCrusher,
  dealBoneCrusherHand,
  driveBoneCrusherBotTurns,
  chooseBotMoveBoneCrusher,
  applyPlayerAction,
  chooseBettingMove,
} from '../base44/shared/poker.ts';
import {
  settleTicTacToe,
  dealTicTacToeHand,
  driveTicTacToeBotTurns,
  chooseBotMoveTicTacToe,
  applyTicTacToeAction,
} from '../base44/shared/ticTacToe.ts';
import {
  settleLowball,
  dealLowballHand,
  driveLowballBotTurns,
  chooseBotMoveLowball,
  lowballBotDiscards,
  applyLowballAction,
} from '../base44/shared/lowball.ts';
import {
  settleDrawGame,
  dealDrawGameHand,
  driveDrawGameBotTurns,
  chooseBotMoveDrawGame,
  drawGameBotDiscards,
  applyDrawGameAction,
  getHandRow,
  getDeckRow,
  saveDeckRow,
} from '../base44/shared/paduki.ts';
import {
  settleDeadSeven,
  dealDeadSevenHand,
  driveDeadSevenBotTurns,
  chooseBotMoveDeadSeven,
  applyDeadSevenAction,
} from '../base44/shared/deadSeven.ts';
import { round } from '../base44/shared/wallet.ts';
import { isPlayMoneyTable } from '../base44/shared/guest.ts';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function fakeBase44({ tables = [], hands = [] } = {}) {
  const store = { tables: [...tables], hands: [...hands] };
  const calls = { walletFilter: 0, walletUpdate: 0, ledgerCreate: 0, tableUpdate: 0 };
  const throwWallet = (what) => {
    throw new Error(`${what} must not be touched on a play-money table`);
  };
  const entities = {
    PokerTable: {
      filter: async (where) => {
        let rows = store.tables;
        if (where && where.join_code) rows = rows.filter((t) => t.join_code === where.join_code);
        if (where && where.game_slug) rows = rows.filter((t) => t.game_slug === where.game_slug);
        return { items: rows };
      },
      get: async (id) => {
        const row = store.tables.find((t) => t.id === id);
        if (!row) {
          const err = new Error('Not found');
          err.status = 404;
          throw err;
        }
        return row;
      },
      create: async (record) => {
        const row = { id: `tbl_${store.tables.length + 1}`, ...record };
        store.tables.push(row);
        return row;
      },
      update: async (id, patch) => {
        calls.tableUpdate += 1;
        const row = store.tables.find((t) => t.id === id);
        if (!row) throw new Error('Table not found');
        Object.assign(row, patch);
        return row;
      },
    },
    PokerHand: {
      filter: async (where) => {
        let rows = store.hands;
        if (where && where.table_id) rows = rows.filter((h) => h.table_id === where.table_id);
        if (where && where.user_id) rows = rows.filter((h) => h.user_id === where.user_id);
        return { items: rows };
      },
      create: async (record) => {
        const row = { id: `hand_${store.hands.length + 1}`, ...record };
        store.hands.push(row);
        return row;
      },
      update: async (id, patch) => {
        const row = store.hands.find((h) => h.id === id);
        if (!row) throw new Error('Hand not found');
        Object.assign(row, patch);
        return row;
      },
    },
    Wallet: {
      filter: async () => throwWallet('Wallet.filter'),
      create: async () => throwWallet('Wallet.create'),
      update: async () => throwWallet('Wallet.update'),
    },
    LedgerEntry: {
      create: async () => throwWallet('LedgerEntry.create'),
    },
  };
  return { asServiceRole: { entities }, _store: store, _calls: calls };
}

function playTable(overrides = {}) {
  return {
    id: 'tbl_1',
    game_slug: 'bone-crusher',
    coin: 'PLAY',
    stake: 1000,
    bet_unit: 100,
    status: 'lobby',
    is_private: false,
    is_play_money: true,
    dealer_seat: 0,
    current_bet: 0,
    pot: 0,
    phase: 'betting',
    reveal_round: 0,
    version: 1,
    created_at: new Date(Date.now() - 2 * BOT_GRACE_MS).toISOString(),
    players_json: JSON.stringify([
      newPlayerState({ userId: 'guest_1111111111111111', handle: 'GuestOne', seat: 0, stake: 1000 }),
    ]),
    ...overrides,
  };
}

function realMoneyTable(overrides = {}) {
  return playTable({
    coin: 'USDT',
    is_play_money: false,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Bot seating rules
// ---------------------------------------------------------------------------

test('seatBots fills a 1-human play-money lobby table to 3 players (1 human + 2 bots)', () => {
  const table = playTable();
  const players = playersOf(table);
  const added = seatBots(table, players);
  assert.equal(added.length, 2);
  assert.equal(players.length, BOT_TARGET_PLAYERS);
  assert.equal(humanPlayers(players).length, 1);
  assert.equal(botPlayers(players).length, 2);
  for (const bot of added) {
    assert.equal(bot.is_bot, true);
    assert.match(bot.user_id, /^bot_[0-9a-f]{8}$/);
    assert.match(bot.handle, /^Bot /);
    assert.equal(bot.stack, 1000, 'bots buy in for the table stake in virtual chips');
  }
  assert.notEqual(added[0].user_id, added[1].user_id);
  assert.notEqual(added[0].handle, added[1].handle);
});

test('seatBots never seats bots on a real-money table', () => {
  const table = realMoneyTable();
  const players = playersOf(table);
  assert.deepEqual(seatBots(table, players), []);
  assert.equal(players.length, 1);
});

test('seatBots does nothing with 2+ humans, on a non-lobby table, or with no humans', () => {
  const twoHumans = playTable({
    players_json: JSON.stringify([
      newPlayerState({ userId: 'guest_1111111111111111', handle: 'GuestOne', seat: 0, stake: 1000 }),
      newPlayerState({ userId: 'guest_2222222222222222', handle: 'Friend', seat: 1, stake: 1000 }),
    ]),
  });
  assert.deepEqual(seatBots(twoHumans, playersOf(twoHumans)), []);

  const inPlay = playTable({ status: 'in_play' });
  assert.deepEqual(seatBots(inPlay, playersOf(inPlay)), []);

  const noHumans = playTable({ players_json: JSON.stringify([]) });
  assert.deepEqual(seatBots(noHumans, playersOf(noHumans)), []);
});

test('seatBots tops a 1-human + 1-bot table back up to 3 players', () => {
  const table = playTable();
  const players = playersOf(table);
  seatBots(table, players);
  // A bot is displaced (a human joined and left again) — one bot left.
  players.splice(2, 1);
  assert.equal(players.length, 2);
  const added = seatBots(table, players);
  assert.equal(added.length, 1);
  assert.equal(players.length, 3);
});

test('a joining human displaces a bot and takes its seat', () => {
  const table = playTable();
  const players = playersOf(table);
  seatBots(table, players);
  assert.equal(players.length, 3);
  const removed = displaceBotForHuman(players);
  assert.ok(removed && removed.is_bot);
  assert.equal(players.length, 2);
  // The human takes the freed seat index.
  players.push(
    newPlayerState({ userId: 'guest_2222222222222222', handle: 'Friend', seat: players.length, stake: 1000 }),
  );
  assert.equal(players.length, 3);
  assert.equal(humanPlayers(players).length, 2);
  assert.equal(botPlayers(players).length, 1);
  assert.deepEqual(
    players.map((p) => p.seat),
    [0, 1, 2],
    'seats stay compact after displacement',
  );
});

test('displaceBotForHuman returns null when no bot is seated', () => {
  const players = playersOf(playTable());
  assert.equal(displaceBotForHuman(players), null);
  assert.equal(players.length, 1);
});

test('bots leave when the last human leaves, and stay while a human is seated', () => {
  const table = playTable();
  const players = playersOf(table);
  seatBots(table, players);
  assert.equal(removeBotsWhenNoHumans(players).length, 0, 'a human is still seated');
  assert.equal(players.length, 3);
  // The human leaves.
  players.splice(0, 1);
  const removed = removeBotsWhenNoHumans(players);
  assert.equal(removed.length, 2);
  assert.equal(players.length, 0);
});

test('botGraceExpired: 60s after creation, and immediately without a creation time', () => {
  const now = Date.now();
  assert.equal(botGraceExpired({ created_at: new Date(now - 61_000).toISOString() }, now), true);
  assert.equal(botGraceExpired({ created_at: new Date(now - 30_000).toISOString() }, now), false);
  assert.equal(botGraceExpired({}, now), true);
  assert.equal(BOT_GRACE_MS, 60_000);
});

test('makeBotPlayer gives distinct ids and names, labelled as a bot', () => {
  const usedNames = [];
  const bots = Array.from({ length: 5 }, (_, i) => {
    const bot = makeBotPlayer({ seat: i, stake: 500, usedNames });
    usedNames.push(bot.handle);
    return bot;
  });
  assert.equal(new Set(bots.map((b) => b.user_id)).size, 5);
  assert.equal(new Set(bots.map((b) => b.handle)).size, 5);
  assert.ok(bots.every((b) => b.is_bot && b.stack === 500));
});

// ---------------------------------------------------------------------------
// Bot betting moves
// ---------------------------------------------------------------------------

test('chooseBettingMove: bet only on a free round when strong, call when facing a bet, fold when broke', () => {
  const table = { coin: 'PLAY', bet_unit: 100, current_bet: 0 };
  const strong = { round_paid: 0, stack: 1000 };
  const weak = { round_paid: 0, stack: 1000 };
  assert.equal(chooseBettingMove(table, strong, true), 'bet');
  assert.equal(chooseBettingMove(table, weak, false), 'check');

  // A bet is out: the bot calls when it can cover it.
  const facingBet = { ...table, current_bet: 100 };
  assert.equal(chooseBettingMove(facingBet, { round_paid: 0, stack: 1000 }, true), 'call');
  assert.equal(chooseBettingMove(facingBet, { round_paid: 0, stack: 1000 }, false), 'call');
  // Cannot cover the bet: fold.
  assert.equal(chooseBettingMove(facingBet, { round_paid: 0, stack: 50 }, true), 'fold');
  // Already paid the bet: check, never bet again (no raises).
  assert.equal(chooseBettingMove(facingBet, { round_paid: 100, stack: 900 }, true), 'check');
});

// ---------------------------------------------------------------------------
// Bot move legality per game (choosers + discards)
// ---------------------------------------------------------------------------

test('Bone Crusher bot: declare is one of high/low/speak and the betting move is legal', () => {
  const table = { coin: 'PLAY', bet_unit: 100, current_bet: 0, phase: 'declare' };
  const players = [
    newPlayerState({ userId: 'bot_aaaaaaaa', handle: 'Bot Rex', seat: 0, stake: 1000, isBot: true }),
  ];
  // A strong high hand (two pair+) with no low.
  const move = chooseBotMoveBoneCrusher(table, players, 0, ['As', 'Ad', 'Ks', 'Kd', 'Qh', 'Jc', '9s']);
  assert.equal(move.action, 'declare');
  assert.ok(['high', 'low', 'speak'].includes(move.declare));
  // Betting phase.
  const betMove = chooseBotMoveBoneCrusher({ ...table, phase: 'betting' }, players, 0, [
    'As',
    'Ad',
    'Ks',
    'Kd',
    'Qh',
    'Jc',
    '9s',
  ]);
  assert.ok(['check', 'bet', 'call', 'fold'].includes(betMove.action));
});

test('Tic Tac Toe bot: declare and betting moves are legal', () => {
  const table = { coin: 'PLAY', bet_unit: 100, current_bet: 0, phase: 'declare' };
  const players = [
    newPlayerState({ userId: 'bot_aaaaaaaa', handle: 'Bot Rex', seat: 0, stake: 1000, isBot: true }),
  ];
  const grid = ['As', 'Ad', 'Ac', 'Ks', 'Kd', 'Qh', 'Jc', '9s', '8d'];
  const move = chooseBotMoveTicTacToe(table, players, 0, grid);
  assert.equal(move.action, 'declare');
  assert.ok(['high', 'low', 'speak'].includes(move.declare));
  const betMove = chooseBotMoveTicTacToe({ ...table, phase: 'betting' }, players, 0, grid);
  assert.ok(['check', 'bet', 'call', 'fold'].includes(betMove.action));
});

test('Lowball bot discards are legal: high cards and pairs go, never more than 5', () => {
  // Pair of kings + 9 + 5 + 3: throw both kings (a pair is worthless
  // and a king is a high card) and the 9, keep 5 + 3 and draw three.
  const discards = lowballBotDiscards(['Ks', 'Kd', '9h', '5c', '3d']);
  assert.deepEqual(discards.sort(), [0, 1, 2]);
  // A made 8-low stands pat.
  assert.deepEqual(lowballBotDiscards(['8s', '7d', '5h', '4c', '2d']), []);
  // A wheel stands pat.
  assert.deepEqual(lowballBotDiscards(['As', '2d', '3h', '4c', '5d']), []);
  const bettingPlayer = newPlayerState({
    userId: 'bot_aaaaaaaa',
    handle: 'Bot Rex',
    seat: 0,
    stake: 1000,
    isBot: true,
  });
  bettingPlayer.drawn = true; // draw pass is over — this is a betting move
  const move = chooseBotMoveLowball(
    { coin: 'PLAY', bet_unit: 100, current_bet: 0, phase: 'betting' },
    [bettingPlayer],
    0,
    ['8s', '7d', '5h', '4c', '2d'],
  );
  assert.ok(['check', 'bet', 'call', 'fold'].includes(move.action));
});

test('Paduki bot discards are legal: duplicate suits go, exactly 1 on the final draw', () => {
  // Two spades + two hearts: throw the lower of each suit.
  const discards = drawGameBotDiscards(['Ks', 'Qs', 'Ah', '9h'], 3, false);
  assert.deepEqual(discards.sort(), [1, 3]);
  // Made hand, final draw: exactly one discard (the lowest card).
  const final = drawGameBotDiscards(['Ks', 'Qh', 'Jd', 'Tc'], 1, true);
  assert.equal(final.length, 1);
  // Made hand, early draw: stand pat.
  assert.deepEqual(drawGameBotDiscards(['Ks', 'Qh', 'Jd', 'Tc'], 3, false), []);
  const move = chooseBotMoveDrawGame(
    { coin: 'PLAY', bet_unit: 100, current_bet: 0, phase: 'declare', reveal_round: 2 },
    [newPlayerState({ userId: 'bot_aaaaaaaa', handle: 'Bot Rex', seat: 0, stake: 1000, isBot: true })],
    0,
    ['Ks', 'Qh', 'Jd', 'Tc'],
    { declare: true },
  );
  assert.equal(move.action, 'declare');
  assert.ok(['high', 'low', 'speak'].includes(move.declare));
});

test('Dead Seven bot never bets a dead hand (a 7 kills it)', () => {
  const table = { coin: 'PLAY', bet_unit: 100, current_bet: 0, phase: 'betting' };
  const players = [
    newPlayerState({ userId: 'bot_aaaaaaaa', handle: 'Bot Rex', seat: 0, stake: 1000, isBot: true }),
  ];
  const dead = chooseBotMoveDeadSeven(table, players, 0, ['7s', 'Ks', 'Qd', 'Jh', 'Tc']);
  assert.equal(dead.action, 'check', 'a dead hand only checks');
  const live = chooseBotMoveDeadSeven(table, players, 0, ['Ks', 'Qd', 'Jh', 'Tc', '9s']);
  assert.ok(['check', 'bet', 'call', 'fold'].includes(live.action));
});

// ---------------------------------------------------------------------------
// Full-hand simulations: 1 human + 2 bots, play money, settle cleanly
// ---------------------------------------------------------------------------

function bettingAction(table, player) {
  const coin = table.coin;
  const currentBet = round(Number(table.current_bet || 0), coin);
  const paid = round(Number(player.round_paid || 0), coin);
  if (paid >= currentBet) return 'check';
  const owed = round(currentBet - paid, coin);
  if (Number(player.stack || 0) < owed) return 'fold';
  return 'call';
}

// The scripted human: check when free, call when facing a bet, fold
// only when broke; stand pat / throw one card on draws; cards speak
// at declare. Every move it makes is legal by construction.
async function humanDrawCards(base44, table, player) {
  const handRow = await getHandRow(base44, table.id, player.user_id);
  const deckRow = await getDeckRow(base44, table.id);
  const hand = handRow ? handRow.cards : [];
  const deck = deckRow ? deckRow.cards : [];
  return { handRow, deckRow, hand, deck };
}

async function persistDraw(base44, handRow, deckRow, result) {
  if (result.newHand && handRow) {
    await base44.asServiceRole.entities.PokerHand.update(handRow.id, {
      cards_json: JSON.stringify(result.newHand),
    });
  }
  if (result.newDeck && deckRow) {
    await saveDeckRow(base44, deckRow.id, result.newDeck);
  }
}

const GAMES = {
  'bone-crusher': {
    deal: dealBoneCrusherHand,
    drive: (b, t, ps, h) => driveBoneCrusherBotTurns(b, t, ps, h),
    settle: (b, t, ps, o, w) => settleBoneCrusher(b, t, ps, o, w, { playMoney: true }),
    humanAct: async (b, t, ps, seat, handsByUser) => {
      const p = ps[seat];
      const action = t.phase === 'declare' ? 'declare' : bettingAction(t, p);
      const res = applyPlayerAction(t, ps, seat, action, t.phase === 'declare' ? 'speak' : '', handsByUser);
      assert.ok(!res.error, `human Bone Crusher action failed: ${res.error}`);
      return res.outcome;
    },
  },
  'tic-tac-toe': {
    deal: dealTicTacToeHand,
    drive: (b, t, ps, h) => driveTicTacToeBotTurns(b, t, ps, h),
    settle: (b, t, ps, o, w) => settleTicTacToe(b, t, ps, o, w, { playMoney: true }),
    humanAct: async (b, t, ps, seat) => {
      const p = ps[seat];
      const action = t.phase === 'declare' ? 'declare' : bettingAction(t, p);
      const res = applyTicTacToeAction(t, ps, seat, action, t.phase === 'declare' ? 'speak' : '');
      assert.ok(!res.error, `human Tic Tac Toe action failed: ${res.error}`);
      return res.outcome;
    },
  },
  lowball: {
    deal: dealLowballHand,
    drive: (b, t, ps) => driveLowballBotTurns(b, t, ps, {}),
    settle: (b, t, ps, o, w) => settleLowball(b, t, ps, o, w, { playMoney: true }),
    humanAct: async (b, t, ps, seat) => {
      const p = ps[seat];
      const { handRow, deckRow, hand, deck } = await humanDrawCards(b, t, p);
      const inDrawPass = ps.some((q) => !q.folded && !q.drawn);
      const res = inDrawPass
        ? applyLowballAction(t, ps, seat, 'draw', [0], hand, deck)
        : applyLowballAction(t, ps, seat, bettingAction(t, p), [], hand, deck);
      assert.ok(!res.error, `human Lowball action failed: ${res.error}`);
      await persistDraw(b, handRow, deckRow, res);
      return res.outcome;
    },
  },
  paduki: {
    deal: dealDrawGameHand,
    drive: (b, t, ps) => driveDrawGameBotTurns(b, t, ps, {}, { declare: true }),
    settle: (b, t, ps, o, w) =>
      settleDrawGame(b, t, ps, o, w, { highOnly: false, gameLabel: 'Paduki', playMoney: true }),
    humanAct: async (b, t, ps, seat) => {
      const p = ps[seat];
      const { handRow, deckRow, hand, deck } = await humanDrawCards(b, t, p);
      let res;
      if (t.phase === 'declare') {
        res = applyDrawGameAction(t, ps, seat, 'declare', 'speak', [], hand, deck, { declare: true });
      } else if (ps.some((q) => !q.folded && !q.drawn)) {
        res = applyDrawGameAction(t, ps, seat, 'draw', '', [0], hand, deck, { declare: true });
      } else {
        res = applyDrawGameAction(t, ps, seat, bettingAction(t, p), '', [], hand, deck, { declare: true });
      }
      assert.ok(!res.error, `human Paduki action failed: ${res.error}`);
      await persistDraw(b, handRow, deckRow, res);
      return res.outcome;
    },
  },
  'straight-high': {
    deal: dealDrawGameHand,
    drive: (b, t, ps) => driveDrawGameBotTurns(b, t, ps, {}, { declare: false }),
    settle: (b, t, ps, o, w) =>
      settleDrawGame(b, t, ps, o, w, { highOnly: true, gameLabel: 'Straight High', playMoney: true }),
    humanAct: async (b, t, ps, seat) => {
      const p = ps[seat];
      const { handRow, deckRow, hand, deck } = await humanDrawCards(b, t, p);
      let res;
      if (ps.some((q) => !q.folded && !q.drawn)) {
        res = applyDrawGameAction(t, ps, seat, 'draw', '', [0], hand, deck, { declare: false });
      } else {
        res = applyDrawGameAction(t, ps, seat, bettingAction(t, p), '', [], hand, deck, { declare: false });
      }
      assert.ok(!res.error, `human Straight High action failed: ${res.error}`);
      await persistDraw(b, handRow, deckRow, res);
      return res.outcome;
    },
  },
  'dead-seven': {
    deal: dealDeadSevenHand,
    drive: (b, t, ps, h) => driveDeadSevenBotTurns(b, t, ps, h),
    settle: (b, t, ps, o, w) => settleDeadSeven(b, t, ps, o, w, { playMoney: true }),
    humanAct: async (b, t, ps, seat) => {
      const res = applyDeadSevenAction(t, ps, seat, bettingAction(t, ps[seat]));
      assert.ok(!res.error, `human Dead Seven action failed: ${res.error}`);
      return res.outcome;
    },
  },
};

// Play one full hand the way the server would: seat bots, deal, then
// alternate the scripted human and the bot driver until the hand
// settles. Returns the settled table row.
async function simulateHand(gameSlug) {
  const game = GAMES[gameSlug];
  const base44 = fakeBase44();
  const table = playTable({ game_slug: gameSlug });
  base44._store.tables.push(table);

  // Mirrors the start entry: seat bots, then deal.
  const players = playersOf(table);
  assert.equal(seatBots(table, players).length, 2, `${gameSlug}: bots should seat`);
  assert.equal(isPlayMoneyTable(table), true);
  let current = await game.deal(base44, table, players);
  assert.equal(current.status, 'in_play');

  let ps = playersOf(current);
  let botTurns = 0;
  let humanTurns = 0;
  let guard = 0;
  while (current.status === 'in_play' && guard++ < 300) {
    const handsByUser = await getTableHands(base44, current.id);
    const turn = ps.find((p) => p.user_id === current.turn_user_id);
    assert.ok(turn, `${gameSlug}: a turn player must exist (turn=${current.turn_user_id})`);
    const seat = ps.indexOf(turn);
    let outcome;
    if (turn.is_bot) {
      botTurns += 1;
      outcome = await game.drive(base44, current, ps, handsByUser);
      assert.notEqual(outcome, 'error', `${gameSlug}: a bot move failed`);
    } else {
      humanTurns += 1;
      outcome = await game.humanAct(base44, current, ps, seat, handsByUser);
    }
    // The entries persist players_json after every action; mirror that
    // so the stored row stays in sync with the in-memory players.
    current.players_json = JSON.stringify(ps);
    ps = playersOf(current);
    if (outcome === 'showdown' || outcome === 'last-standing') {
      const last = activePlayers(ps)[0];
      const settled = await game.settle(
        base44,
        current,
        ps,
        outcome,
        outcome === 'last-standing' ? last?.user_id : undefined,
      );
      current = settled.table;
      break;
    }
    assert.equal(outcome, 'continue', `${gameSlug}: unexpected outcome ${outcome}`);
  }

  assert.equal(current.status, 'settled', `${gameSlug}: hand did not settle within the guard`);
  assert.ok(botTurns > 0, `${gameSlug}: bots never got a turn`);
  assert.ok(humanTurns > 0, `${gameSlug}: the human never got a turn`);
  return { base44, table: current, botTurns, humanTurns };
}

for (const gameSlug of Object.keys(GAMES)) {
  test(`full hand settles with bots: ${gameSlug} (1 human + 2 bots, play money)`, async () => {
    const { base44, table, botTurns, humanTurns } = await simulateHand(gameSlug);
    const result = JSON.parse(table.result_json);
    assert.equal(result.fee, 0, 'play money takes no fee');
    assert.equal(result.distributable, result.pot, 'the whole pot is paid out');
    const players = playersOf(table);
    assert.equal(players.length, 3);
    assert.equal(humanPlayers(players).length, 1);
    assert.equal(botPlayers(players).length, 2);
    // Chip conservation: the settle pays each player their unspent
    // stack plus their share of the pot as `credit`, so the credits
    // sum to the 3 buy-ins that went in. (The settled `stack` is the
    // unspent remainder, not the payout — the payout is `credit`.)
    const totalCredit = players.reduce((sum, p) => sum + Number(p.result?.credit || 0), 0);
    assert.equal(totalCredit, 3 * 1000, 'credits sum to 3 buy-ins after settlement');
    const totalWinnings = players.reduce((sum, p) => sum + Number(p.result?.winnings || 0), 0);
    assert.equal(totalWinnings, result.distributable, 'winnings sum to the distributable pot');
    assert.ok(players.every((p) => Number(p.stack || 0) >= 0), 'no negative stacks');
    // Bots never touched a wallet or a ledger.
    assert.equal(base44._calls.walletFilter, 0);
    assert.equal(base44._calls.walletUpdate, 0);
    assert.equal(base44._calls.ledgerCreate, 0);
    assert.ok(botTurns >= 1 && humanTurns >= 1, `bot turns ${botTurns}, human turns ${humanTurns}`);
  });
}

test('bots never seat on a real-money table, so a lone human still cannot deal', () => {
  const table = realMoneyTable();
  const players = playersOf(table);
  assert.deepEqual(seatBots(table, players), []);
  assert.equal(players.length, 1, 'still 1 player — the 2+ human rule holds');
});
