// Guest play + private tables for Chain Gang Poker.
//
// Poker Friends-style entry: a signed-out visitor can play without an
// account, and any host can open a private table and invite friends with
// a link + a 6-character join code. Guest tables are VIRTUAL play chips
// only — no real-money stakes, no crypto escrow, no house fee — and
// private tables never appear in public lobby lists.
//
// A guest is identified by a random id stored in the browser
// (localStorage) plus a display name they pick. There is no account,
// no email, no password. Guest ids are only ever honoured on
// play-money tables: every wrapper that accepts a guest identity
// refuses guest play on real-money tables, and settlement only takes
// the play-money branch when the table itself is flagged play-money.
// Real-money play (requireUser + wallet escrow + 5% fee) is untouched.

import { round, handleFor, requireUser } from './wallet.ts';
import { newPlayerState } from './poker.ts';

export const PLAY_MONEY_COIN = 'PLAY';
export const PLAY_MONEY_BUY_INS = [500, 1000, 5000];
export const DEFAULT_PLAY_BUY_IN = 1000;
export const MAX_POKER_PLAYERS = 5;

export const GUEST_GAME_SLUGS = [
  'bone-crusher',
  'tic-tac-toe',
  'straight-high',
  'lowball',
  'paduki',
  'dead-seven',
];

export const GUEST_GAME_NAMES = {
  'bone-crusher': 'Bone Crusher',
  'tic-tac-toe': 'Tic Tac Toe',
  'straight-high': 'Straight High',
  lowball: 'Lowball',
  paduki: 'Paduki',
  'dead-seven': 'Dead Seven',
};

// Guest ids are minted in the browser: "guest_" + 16 lowercase hex
// chars. The format is checked server-side so a caller cannot smuggle
// a real user id (or anyone else's handle) through the guest fields.
const GUEST_ID_RE = /^guest_[0-9a-f]{16}$/;

// Join codes are 6 characters from an unambiguous alphabet — no 0/O,
// no 1/I/L — so a code read out loud cannot be misheard.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomBelow(n) {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  } catch {
    return Math.floor(Math.random() * n);
  }
}

export function makeGuestId() {
  let hex = '';
  for (let i = 0; i < 16; i++) hex += '0123456789abcdef'[randomBelow(16)];
  return `guest_${hex}`;
}

export function makeJoinCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += JOIN_CODE_ALPHABET[randomBelow(JOIN_CODE_ALPHABET.length)];
  return code;
}

// Display names are shown to other players at the table, so strip
// markup and cap the length. Falls back to Guest-XXXX (last 4 of the
// guest id) when nothing usable was given.
export function sanitizeGuestName(name, fallback) {
  const clean = String(name || '')
    .replace(/[<>&"']/g, '')
    .trim()
    .slice(0, 24);
  return clean || fallback || 'Guest';
}

// Guest identity as sent by the browser: { guest_id, guest_name }.
// Returns { id, handle } or null when the body carries no valid guest.
export function parseGuestIdentity(body) {
  const id = String((body && body.guest_id) || '').trim();
  if (!GUEST_ID_RE.test(id)) return null;
  const fallback = `Guest-${id.slice(-4).toUpperCase()}`;
  return { id, handle: sanitizeGuestName(body && body.guest_name, fallback) };
}

// Who is calling: the signed-in account when there is one, otherwise
// a guest identity from the request body, otherwise null. Callers pass
// the parsed request body (guest fields live there); the signed-in
// account always wins over guest fields.
export async function resolvePokerIdentity(base44, body) {
  const user = await requireUser(base44);
  if (user) return { id: user.id, handle: handleFor(user), isGuest: false };
  const guest = parseGuestIdentity(body || {});
  if (guest) return { id: guest.id, handle: guest.handle, isGuest: true };
  return null;
}

export function isPlayMoneyTable(table) {
  return !!table && table.is_play_money === true;
}

export function isPrivateTable(table) {
  return !!table && table.is_private === true;
}

// Public lobby lists show real-money tables and any public play-money
// table — never a private one. (All guest tables are private, so this
// is what keeps them out of the lobby.)
export function isPublicTable(table) {
  return !isPrivateTable(table);
}

async function asRows(promise) {
  const res = await promise;
  if (Array.isArray(res)) return res;
  return (res && res.items) || [];
}

function playersOf(table) {
  try {
    return JSON.parse(table.players_json || '[]');
  } catch {
    return [];
  }
}

// Mint a join code that no other table is using. Collisions are
// near-impossible (32^6 codes) but the check is cheap, so retry a few
// times rather than ever issuing a duplicate.
async function mintJoinCode(base44) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeJoinCode();
    const rows = await asRows(base44.asServiceRole.entities.PokerTable.filter({ join_code: code }));
    if (rows.length === 0) return code;
  }
  // Last resort: a time-suffixed code is still unique enough for a
  // private invite, and the filter check above guards the common path.
  return `${makeJoinCode()}${String(Date.now()).slice(-2)}`.slice(0, 6);
}

// Create a private play-money table for one of the six Chain Gang
// games. The host (signed-in user or guest) is seated at once. No
// wallet is touched — the buy-in is virtual chips.
export async function createGuestTableRecord(base44, { gameSlug, title, buyIn, me }) {
  if (!GUEST_GAME_SLUGS.includes(gameSlug)) {
    throw new Error('Unknown poker game.');
  }
  const chips = PLAY_MONEY_BUY_INS.includes(Number(buyIn)) ? Number(buyIn) : DEFAULT_PLAY_BUY_IN;
  const name = GUEST_GAME_NAMES[gameSlug];
  const joinCode = await mintJoinCode(base44);
  const table = await base44.asServiceRole.entities.PokerTable.create({
    title: String(title || `${name} · private table`).trim() || `${name} · private table`,
    game_slug: gameSlug,
    coin: PLAY_MONEY_COIN,
    stake: round(chips, PLAY_MONEY_COIN),
    bet_unit: round(chips / 10, PLAY_MONEY_COIN),
    status: 'lobby',
    phase: 'betting',
    creator_id: me.id,
    creator_handle: me.handle,
    pot: 0,
    current_bet: 0,
    reveal_round: 0,
    dealer_seat: 0,
    turn_user_id: '',
    turn_expires_at: '',
    is_private: true,
    is_play_money: true,
    join_code: joinCode,
    players_json: JSON.stringify([newPlayerState({ userId: me.id, handle: me.handle, seat: 0, stake: chips })]),
    result_json: '',
    settle_note: '',
    version: 1,
  });
  return table;
}

// Seat a player at a private play-money table, found by table id (the
// invite link) or by join code (typed into the hub or a lobby).
// Refuses real-money tables outright: guest entry points never touch
// escrow, and a signed-in user joins real-money tables through the
// per-game join function instead.
export async function joinGuestTableRecord(base44, { tableId, joinCode, me }) {
  let table = null;
  if (joinCode) {
    const code = String(joinCode).trim().toUpperCase();
    if (!code) throw new Error('Join code is required.');
    const rows = await asRows(base44.asServiceRole.entities.PokerTable.filter({ join_code: code }));
    table = rows.find((t) => isPrivateTable(t)) || null;
    if (!table) throw new Error('No private table with that code.');
  } else if (tableId) {
    table = await base44.asServiceRole.entities.PokerTable.get(String(tableId).trim()).catch((e) =>
      e.status === 404 ? null : Promise.reject(e),
    );
    if (!table) throw new Error('Table not found.');
  } else {
    throw new Error('table_id or join_code is required.');
  }

  if (!isPlayMoneyTable(table)) {
    throw new Error('This table is real money — sign in and join from its lobby.');
  }
  if (!isPrivateTable(table)) {
    throw new Error('This table is not private.');
  }
  if (table.status !== 'lobby') {
    throw new Error('This table is already playing.');
  }
  const players = playersOf(table);
  if (players.some((p) => p.user_id === me.id)) {
    throw new Error('You are already seated at this table.');
  }
  if (players.length >= MAX_POKER_PLAYERS) {
    throw new Error(`This table is full — ${MAX_POKER_PLAYERS} players max.`);
  }

  const stake = round(Number(table.stake || 0), table.coin);
  const seat = players.length;
  players.push(newPlayerState({ userId: me.id, handle: me.handle, seat, stake }));
  const updated = await base44.asServiceRole.entities.PokerTable.update(table.id, {
    players_json: JSON.stringify(players),
    version: Number(table.version || 0) + 1,
  });
  return updated;
}
