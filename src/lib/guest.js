// Guest identity for Chain Gang Poker play-money tables.
//
// A guest is a random id minted in this browser (localStorage) plus a
// display name they pick. No account, no email, no password. The id is
// sent with every poker call while signed out, so the server can seat
// the guest, deal them cards, and take their turns. Signed-in players
// never need it — their account id is used instead.

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'betthat-guest';
const GUEST_ID_RE = /^guest_[0-9a-f]{16}$/;

export const PLAY_BUY_INS = [500, 1000, 5000];
export const DEFAULT_PLAY_BUY_IN = 1000;

function randomHex(n) {
  try {
    const buf = new Uint32Array(Math.ceil(n / 8));
    crypto.getRandomValues(buf);
    let out = '';
    for (let i = 0; i < buf.length && out.length < n; i++) out += buf[i].toString(16).padStart(8, '0');
    return out.slice(0, n);
  } catch {
    let out = '';
    for (let i = 0; i < n; i++) out += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    return out;
  }
}

export function cleanGuestName(name) {
  return String(name || '')
    .replace(/[<>&"']/g, '')
    .trim()
    .slice(0, 24);
}

export function getGuest() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && GUEST_ID_RE.test(parsed.id)) {
        return { id: parsed.id, handle: cleanGuestName(parsed.handle) };
      }
    }
  } catch {
    // Corrupt or unavailable storage — mint a fresh guest below.
  }
  const guest = { id: `guest_${randomHex(16)}`, handle: '' };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
  } catch {
    // Private mode or blocked storage: the id still works for this visit.
  }
  return guest;
}

export function saveGuestHandle(handle) {
  const guest = { ...getGuest(), handle: cleanGuestName(handle) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guest));
  } catch {
    // See getGuest — the name still applies for this visit.
  }
  return guest;
}

export function guestDisplayName(guest) {
  const g = guest || getGuest();
  return (g.handle || '').trim() || `Guest-${g.id.slice(-4).toUpperCase()}`;
}

// Extra fields for a poker function call while signed out. Signed-in
// callers pass nothing — the server uses their account.
export function guestPayload(guest) {
  const g = guest || getGuest();
  return { guest_id: g.id, guest_name: guestDisplayName(g) };
}

// React hook for the guest identity: the stored guest plus a way to
// save the display name (re-renders the table/lobby with the new name).
export function useGuest() {
  const [guest, setGuest] = useState(() => getGuest());
  const saveName = useCallback((name) => {
    setGuest(saveGuestHandle(name));
  }, []);
  return { guest, displayName: guestDisplayName(guest), saveName };
}

// The id the table uses for "is this me" checks: the account id when
// signed in, the guest id otherwise.
export function pokerIdentityId(user, guest) {
  return user?.id || (guest || getGuest()).id;
}
