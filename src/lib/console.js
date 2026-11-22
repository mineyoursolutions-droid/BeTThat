import { GAMES } from '@/lib/demo';

export const PLATFORMS = [
  {
    id: 'wii',
    label: 'Nintendo Wii',
    short: 'Wii',
    accent: '#A3E635',
    method: 'Couch play',
    blurb:
      "Wii Play Pool has no online mode and Nintendo retired the Wii's online services in 2014, so no Wii can sign in here. A Wii room is a couch session: two players on one console, a scoreboard photo for proof, and settlement through the normal match flow.",
  },
  {
    id: 'switch',
    label: 'Nintendo Switch',
    short: 'Switch',
    accent: '#FB7185',
    method: 'Friend lobby',
    blurb:
      'Pool titles on Switch connect through the friends list and a private room inside the game. Add your opponent first, then open the room here so the stake is on record before the break.',
  },
  {
    id: 'ps5',
    label: 'PlayStation 5',
    short: 'PS5',
    accent: '#60A5FA',
    method: 'Private lobby',
    blurb:
      'Private lobbies and invites are handled inside the game. Paste the lobby code into the room so only your opponent can walk in.',
  },
  {
    id: 'xbox',
    label: 'Xbox Series X|S',
    short: 'Xbox',
    accent: '#34D399',
    method: 'Custom lobby',
    blurb:
      'Create a custom game with an invite-only slot, then drop the lobby code in the room here. Party chat keeps the table honest.',
  },
  {
    id: 'pc',
    label: 'PC / Steam',
    short: 'PC',
    accent: '#22D3EE',
    method: 'Room code or direct IP',
    blurb:
      'Private tables, room codes and direct-IP/LAN joins all work on PC. Paste the code or address into the game once the seat is locked.',
  },
  {
    id: 'mobile',
    label: 'Mobile',
    short: 'Mobile',
    accent: '#E879F9',
    method: 'Friend challenge',
    blurb:
      'Lock the room here, then send an in-game friend challenge. Both apps have to be on the same server region to find each other.',
  },
];

export const platformById = (id) => PLATFORMS.find((p) => p.id === id) || PLATFORMS[0];

export const BILLIARDS = [
  {
    slug: 'wii-pool',
    connect: 'couch',
    how: 'Two players, one Wii. The room timestamps the session and the winner is settled from an uploaded photo of the final rack.',
  },
  {
    slug: 'pool',
    connect: 'friend',
    how: 'Send an in-game friend challenge. Lock the room here first so the stake and rules are on record before the break.',
  },
  {
    slug: 'pure-pool',
    connect: 'lobby',
    how: 'Open a private table and hand your opponent the table code. The room holds that code until both players are seated.',
  },
  {
    slug: 'snooker19',
    connect: 'lobby',
    how: 'Private match invites work with a room code — paste it into the room so only your opponent can join.',
  },
  {
    slug: 'pool-nation',
    connect: 'lobby',
    how: 'Custom lobbies are invite-only: share the lobby code once your opponent has taken the seat here.',
  },
];

const PLATFORM_LABEL = {
  wii: 'Wii',
  switch: 'Switch',
  ps5: 'PS5',
  xbox: 'Xbox',
  pc: 'PC',
  mobile: 'Mobile',
};

export const CONNECT_LABEL = {
  couch: 'Couch play',
  friend: 'Friend invite',
  lobby: 'Private lobby',
  ip: 'Direct IP',
};

const BOOK = BILLIARDS.map((entry) => ({
  ...entry,
  game: GAMES.find((g) => g.slug === entry.slug),
})).filter((entry) => entry.game);

export const gamesFor = (platformId) => {
  const label = PLATFORM_LABEL[platformId];
  const list = BOOK.filter((entry) => (entry.game.platforms || []).includes(label));
  return list.length ? list : BOOK;
};

export const billiardsBook = () => BOOK;

export const newRoomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tail = '';
  for (let i = 0; i < 5; i += 1) tail += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `BT-${tail}`;
};

export const handleOf = (user) =>
  (user && (user.full_name || (user.email ? String(user.email).split('@')[0] : ''))) || 'Player';

export const roomStatusLabel = (status) =>
  ({
    open: 'Seat open',
    matched: 'Table set',
    closed: 'Closed',
  }[status] || status);