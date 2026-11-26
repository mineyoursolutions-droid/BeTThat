// Guest play + private tables for Chain Gang Poker.
//
// Run with: npm test   (node --test, no extra dependencies)
// These tests run the real shared server code (base44/shared/*.ts)
// against a fake Base44 client — no network, no database.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeGuestId,
  makeJoinCode,
  sanitizeGuestName,
  parseGuestIdentity,
  resolvePokerIdentity,
  isPlayMoneyTable,
  isPrivateTable,
  isPublicTable,
  createGuestTableRecord,
  joinGuestTableRecord,
  PLAY_MONEY_BUY_INS,
  DEFAULT_PLAY_BUY_IN,
  MAX_POKER_PLAYERS,
} from '../base44/shared/guest.ts';
import { settleBoneCrusher, newPlayerState } from '../base44/shared/poker.ts';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function fakeBase44({ user = null, tables = [], hands = [], wallets = {} } = {}) {
  const store = { tables: [...tables], hands: [...hands] };
  const calls = { walletFilter: 0, walletUpdate: 0, ledgerCreate: 0, tableUpdate: 0, tableCreate: 0 };
  const base44 = {
    auth: {
      me: async () => {
        if (!user) {
          const err = new Error('Unauthorized');
          err.status = 401;
          throw err;
        }
        return user;
      },
    },
    asServiceRole: {
      entities: {
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
            calls.tableCreate += 1;
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
          filter: async (where) => ({
            items: store.hands.filter((h) => !where || h.table_id === where.table_id),
          }),
        },
        Wallet: {
          filter: async ({ user_id, coin }) => {
            calls.walletFilter += 1;
            const w = wallets[`${user_id}:${coin}`];
            return { items: w ? [w] : [] };
          },
          create: async (record) => ({ id: `w_${record.user_id}`, ...record }),
          update: async (id, patch) => {
            calls.walletUpdate += 1;
            return { id, ...patch };
          },
        },
        LedgerEntry: {
          create: async (record) => {
            calls.ledgerCreate += 1;
            return { id: `led_${calls.ledgerCreate}`, ...record };
          },
        },
      },
    },
    _store: store,
    _calls: calls,
  };
  return base44;
}

function privateTable(overrides = {}) {
  return {
    id: 'tbl_1',
    game_slug: 'bone-crusher',
    coin: 'PLAY',
    stake: 1000,
    status: 'lobby',
    is_private: true,
    is_play_money: true,
    join_code: 'ABC123',
    players_json: JSON.stringify([
      newPlayerState({ userId: 'guest_aaaaaaaaaaaaaaaa', handle: 'Host', seat: 0, stake: 1000 }),
    ]),
    version: 1,
    ...overrides,
  };
}

const guestMe = { id: 'guest_1111111111111111', handle: 'GuestOne', isGuest: true };

// ---------------------------------------------------------------------------
// Guest sessions
// ---------------------------------------------------------------------------

test('guest ids are guest_ + 16 lowercase hex, and unique', () => {
  const ids = new Set(Array.from({ length: 200 }, () => makeGuestId()));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, /^guest_[0-9a-f]{16}$/);
});

test('join codes are 6 chars from the unambiguous alphabet', () => {
  const codes = new Set(Array.from({ length: 200 }, () => makeJoinCode()));
  assert.ok(codes.size > 190, 'codes should almost never collide');
  for (const code of codes) assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
});

test('guest names are sanitised and fall back to Guest-XXXX', () => {
  assert.equal(sanitizeGuestName('  Ada <script>  ', 'Guest-ABCD'), 'Ada script');
  assert.equal(sanitizeGuestName('', 'Guest-ABCD'), 'Guest-ABCD');
  assert.equal(sanitizeGuestName('a'.repeat(40), 'Guest-ABCD').length, 24);
  assert.equal(sanitizeGuestName(null, null), 'Guest');
});

test('parseGuestIdentity accepts a valid guest and rejects anything else', () => {
  const parsed = parseGuestIdentity({ guest_id: 'guest_abcdef0123456789', guest_name: 'Ada' });
  assert.deepEqual(parsed, { id: 'guest_abcdef0123456789', handle: 'Ada' });
  // No name given -> Guest-XXXX from the id.
  assert.equal(parseGuestIdentity({ guest_id: 'guest_abcdef0123456789' }).handle, 'Guest-6789');
  assert.equal(parseGuestIdentity({ guest_id: 'user_123' }), null);
  assert.equal(parseGuestIdentity({ guest_id: 'guest_SHORT' }), null);
  assert.equal(parseGuestIdentity({}), null);
  assert.equal(parseGuestIdentity(null), null);
});

test('resolvePokerIdentity: signed-in account wins over guest fields', async () => {
  const signedIn = fakeBase44({ user: { id: 'user_1', full_name: 'Well Played' } });
  const me = await resolvePokerIdentity(signedIn, { guest_id: 'guest_abcdef0123456789', guest_name: 'Ada' });
  assert.deepEqual(me, { id: 'user_1', handle: 'Well Played', isGuest: false });
});

test('resolvePokerIdentity: guest when signed out, null when neither', async () => {
  const signedOut = fakeBase44();
  const guest = await resolvePokerIdentity(signedOut, { guest_id: 'guest_abcdef0123456789', guest_name: 'Ada' });
  assert.deepEqual(guest, { id: 'guest_abcdef0123456789', handle: 'Ada', isGuest: true });
  assert.equal(await resolvePokerIdentity(signedOut, {}), null);
});

// ---------------------------------------------------------------------------
// Private tables: create + join by code
// ---------------------------------------------------------------------------

test('createGuestTableRecord creates a private play-money table with the host seated', async () => {
  const base44 = fakeBase44();
  const table = await createGuestTableRecord(base44, {
    gameSlug: 'bone-crusher',
    buyIn: 500,
    me: guestMe,
  });
  assert.equal(table.game_slug, 'bone-crusher');
  assert.equal(table.coin, 'PLAY');
  assert.equal(table.stake, 500);
  assert.equal(table.bet_unit, 50);
  assert.equal(table.is_private, true);
  assert.equal(table.is_play_money, true);
  assert.match(table.join_code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(table.status, 'lobby');
  const players = JSON.parse(table.players_json);
  assert.equal(players.length, 1);
  assert.equal(players[0].user_id, guestMe.id);
  assert.equal(players[0].handle, 'GuestOne');
});

test('createGuestTableRecord defaults a bad buy-in to 1000 and rejects unknown games', async () => {
  const base44 = fakeBase44();
  const table = await createGuestTableRecord(base44, { gameSlug: 'paduki', buyIn: 999999, me: guestMe });
  assert.equal(table.stake, DEFAULT_PLAY_BUY_IN);
  assert.ok(PLAY_MONEY_BUY_INS.includes(DEFAULT_PLAY_BUY_IN));
  await assert.rejects(
    () => createGuestTableRecord(base44, { gameSlug: 'chess', me: guestMe }),
    /Unknown poker game/,
  );
});

test('joinGuestTableRecord seats a second guest by join code', async () => {
  const table = privateTable();
  const base44 = fakeBase44({ tables: [table] });
  const second = { id: 'guest_2222222222222222', handle: 'Friend', isGuest: true };
  const updated = await joinGuestTableRecord(base44, { joinCode: 'abc123', me: second });
  const players = JSON.parse(updated.players_json);
  assert.equal(players.length, 2);
  assert.equal(players[1].user_id, second.id);
  assert.equal(players[1].seat, 1);
});

test('joinGuestTableRecord refuses real-money and non-private tables', async () => {
  const realMoney = privateTable({ coin: 'USDT', is_play_money: false });
  const base44 = fakeBase44({ tables: [realMoney] });
  await assert.rejects(() => joinGuestTableRecord(base44, { joinCode: 'ABC123', me: guestMe }), /real money/);

  const publicPlay = privateTable({ is_private: false });
  const base44b = fakeBase44({ tables: [publicPlay] });
  // Reached by table id (the by-code lookup only ever finds private tables).
  await assert.rejects(() => joinGuestTableRecord(base44b, { tableId: 'tbl_1', me: guestMe }), /not private/);
});

test('joinGuestTableRecord refuses a full table and an already-seated player', async () => {
  const players = Array.from({ length: MAX_POKER_PLAYERS }, (_, i) =>
    newPlayerState({ userId: `guest_${String(i + 5).repeat(16)}`, handle: `P${i}`, seat: i, stake: 1000 }),
  );
  const full = privateTable({ players_json: JSON.stringify(players) });
  const base44 = fakeBase44({ tables: [full] });
  await assert.rejects(() => joinGuestTableRecord(base44, { joinCode: 'ABC123', me: guestMe }), /full/);

  const seated = privateTable();
  const base44b = fakeBase44({ tables: [seated] });
  await assert.rejects(
    () => joinGuestTableRecord(base44b, { joinCode: 'ABC123', me: { id: 'guest_aaaaaaaaaaaaaaaa', handle: 'Host' } }),
    /already seated/,
  );
});

// ---------------------------------------------------------------------------
// Private tables stay out of public lists
// ---------------------------------------------------------------------------

test('private tables never appear in a public lobby list', () => {
  const mixed = [
    privateTable({ id: 'tbl_1' }),
    privateTable({ id: 'tbl_2', is_private: false, is_play_money: true }),
    privateTable({ id: 'tbl_3', is_private: false, is_play_money: false, coin: 'USDT' }),
    privateTable({ id: 'tbl_4', status: 'in_play' }),
  ];
  // The lobby filter: drop anything flagged private.
  const listed = mixed.filter((t) => !t.is_private);
  assert.deepEqual(
    listed.map((t) => t.id),
    ['tbl_2', 'tbl_3'],
  );
  assert.equal(isPublicTable(mixed[0]), false);
  assert.equal(isPublicTable(mixed[1]), true);
  assert.equal(isPublicTable(mixed[2]), true);
  assert.equal(isPrivateTable(mixed[0]), true);
  assert.equal(isPlayMoneyTable(mixed[0]), true);
  assert.equal(isPlayMoneyTable(mixed[2]), false);
});

// ---------------------------------------------------------------------------
// Settlement: play money takes no fee and never touches a wallet
// ---------------------------------------------------------------------------

function settledPlayers() {
  const winner = newPlayerState({ userId: 'guest_1111111111111111', handle: 'GuestOne', seat: 0, stake: 10 });
  const loser = newPlayerState({ userId: 'guest_2222222222222222', handle: 'Friend', seat: 1, stake: 10 });
  winner.contributed = 10;
  loser.contributed = 10;
  winner.stack = 0;
  loser.stack = 0;
  loser.folded = true;
  return [winner, loser];
}

test('play-money settlement: fee 0, no wallet or ledger calls, chips stay in the result', async () => {
  const table = {
    id: 'tbl_1',
    title: 'Bone Crusher table',
    coin: 'USDT',
    stake: 10,
    is_play_money: true,
    version: 1,
  };
  // Wallet methods throw if touched — proving the play-money path never calls them.
  const base44 = fakeBase44({ tables: [table], wallets: {} });
  base44.asServiceRole.entities.Wallet.filter = async () => {
    throw new Error('wallet must not be touched on a play-money table');
  };
  const { table: settled } = await settleBoneCrusher(base44, table, settledPlayers(), 'last-standing', 'guest_1111111111111111', {
    playMoney: true,
  });
  assert.equal(settled.status, 'settled');
  const result = JSON.parse(settled.result_json);
  assert.equal(result.fee, 0);
  assert.equal(result.pot, 20);
  assert.equal(result.distributable, 20);
  const players = JSON.parse(settled.players_json);
  assert.equal(players[0].result.winnings, 20);
  assert.equal(players[0].result.credit, 20);
  assert.equal(base44._calls.walletFilter, 0);
  assert.equal(base44._calls.walletUpdate, 0);
  assert.equal(base44._calls.ledgerCreate, 0);
});

test('real-money settlement still takes the 5% fee and pays out through the wallet', async () => {
  const table = {
    id: 'tbl_1',
    title: 'Bone Crusher table',
    coin: 'USDT',
    stake: 10,
    is_play_money: false,
    version: 1,
  };
  const wallets = {
    'guest_1111111111111111:USDT': { id: 'w1', available: 10000, locked: 1000 },
    'guest_2222222222222222:USDT': { id: 'w2', available: 10000, locked: 1000 },
  };
  const base44 = fakeBase44({ tables: [table], wallets });
  const { table: settled } = await settleBoneCrusher(base44, table, settledPlayers(), 'last-standing', 'guest_1111111111111111', {
    playMoney: false,
  });
  const result = JSON.parse(settled.result_json);
  assert.equal(result.fee, 1); // 5% of a 20 pot
  assert.equal(result.distributable, 19);
  const players = JSON.parse(settled.players_json);
  assert.equal(players[0].result.winnings, 19);
  assert.ok(base44._calls.walletFilter > 0, 'wallet was read');
  assert.ok(base44._calls.walletUpdate > 0, 'wallet was updated');
  assert.equal(base44._calls.ledgerCreate, 2, 'one ledger entry per player');
});
