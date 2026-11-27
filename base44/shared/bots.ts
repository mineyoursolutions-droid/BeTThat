// Bot players for Chain Gang Poker — play-money tables only.
//
// A play-money table with a single human seated fills its empty seats
// with bots (up to 3 players total: 1 human + 2 bots) and deals the
// hand on its own, so a player who pulls up alone actually sees cards.
// Bots are labelled with is_bot in the player state and shown with a
// BOT badge in the UI; they are never presented as real players. Bots
// only ever sit on play-money (PLAY coin) tables: they play with
// virtual chips, and play-money settlement already skips fees, wallets
// and ledger entries. Real-money tables never get bots and keep the
// human-only 2+ player rule.

import { newPlayerState } from './poker.ts';
import { isPlayMoneyTable, MAX_POKER_PLAYERS } from './guest.ts';
import { round } from './wallet.ts';

// How many players a bot-filled table has: 1 human + 2 bots.
export const BOT_TARGET_PLAYERS = 3;

// How long a 1-human play-money table waits in the lobby before the
// bots deal on their own, so friends have a window to join first.
// Pressing Deal skips the wait.
export const BOT_GRACE_MS = 60_000;

export const BOT_ID_PREFIX = 'bot_';

// Bot handles, picked in order and never repeated at one table.
export const BOT_NAMES = ['Bot Rex', 'Bot Ivy', 'Bot Max', 'Bot Lou', 'Bot Ace'];

function randomHex(n) {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

export function isBotId(userId) {
  return typeof userId === 'string' && userId.startsWith(BOT_ID_PREFIX);
}

export function makeBotId() {
  return `${BOT_ID_PREFIX}${randomHex(8)}`;
}

export function humanPlayers(players) {
  return players.filter((p) => !p.is_bot);
}

export function botPlayers(players) {
  return players.filter((p) => p.is_bot);
}

export function makeBotPlayer({ seat, stake, usedNames = [] }) {
  const name = BOT_NAMES.find((n) => !usedNames.includes(n)) || `Bot ${usedNames.length + 1}`;
  return newPlayerState({
    userId: makeBotId(),
    handle: name,
    seat,
    stake,
    isBot: true,
  });
}

// Seat bots on a play-money lobby table that has exactly one human,
// filling up to BOT_TARGET_PLAYERS (and topping up if a bot was
// displaced earlier). Returns the bots that were seated ([] when
// nothing was added). Never seats bots on a real-money table, on a
// table that is not in the lobby, or when more than one human is
// already seated. Mutates `players` in place; the caller persists
// players_json.
export function seatBots(table, players) {
  if (!isPlayMoneyTable(table) || table.status !== 'lobby') return [];
  if (humanPlayers(players).length !== 1) return [];
  const stake = round(Number(table.stake || 0), table.coin);
  const added = [];
  while (players.length < BOT_TARGET_PLAYERS && players.length < MAX_POKER_PLAYERS) {
    const bot = makeBotPlayer({
      seat: players.length,
      stake,
      usedNames: players.map((p) => p.handle),
    });
    players.push(bot);
    added.push(bot);
  }
  return added;
}

// A joining human takes a bot's seat: remove the most recently seated
// bot so the table never exceeds the player limit. Returns the removed
// bot, or null when no bot is seated. Mutates `players` in place.
export function displaceBotForHuman(players) {
  for (let i = players.length - 1; i >= 0; i--) {
    if (players[i].is_bot) return players.splice(i, 1)[0];
  }
  return null;
}

// Bots only sit while at least one human is seated. When the last
// human leaves a table, remove every bot with them. Returns the
// removed bots. Mutates `players` in place.
export function removeBotsWhenNoHumans(players) {
  if (humanPlayers(players).length > 0) return [];
  const removed = botPlayers(players);
  for (let i = players.length - 1; i >= 0; i--) {
    if (players[i].is_bot) players.splice(i, 1);
  }
  return removed;
}

// Has the table been waiting in the lobby long enough for the bots to
// deal on their own? A table with no creation time counts as old enough.
export function botGraceExpired(table, now = Date.now()) {
  const created = table.created_at ? new Date(table.created_at).getTime() : NaN;
  if (Number.isNaN(created)) return true;
  return now - created >= BOT_GRACE_MS;
}
