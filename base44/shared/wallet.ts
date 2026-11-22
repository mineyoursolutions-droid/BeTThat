export const COINS = ['BTC', 'ETH', 'USDT', 'USDC'];

export const HOUSE_FEE = 0.05;

export function round(value, coin) {
  const dp = coin === 'USDT' || coin === 'USDC' ? 2 : 8;
  const factor = 10 ** dp;
  return Math.round(Number(value || 0) * factor) / factor;
}

export function handleFor(user) {
  if (user && user.full_name) return user.full_name;
  const email = (user && user.email) || '';
  return email.split('@')[0] || 'player';
}

export async function requireUser(base44) {
  return base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
}

async function asRows(promise) {
  const res = await promise;
  if (Array.isArray(res)) return res;
  return (res && res.items) || [];
}

export async function ensureWallet(base44, userId, coin) {
  const rows = await asRows(base44.asServiceRole.entities.Wallet.filter({ user_id: userId, coin }));
  if (rows.length) return rows[0];
  return base44.asServiceRole.entities.Wallet.create({ user_id: userId, coin, available: 0, locked: 0 });
}

// available: change to spendable balance · locked: change to escrowed balance
export async function moveFunds(base44, userId, coin, { available = 0, locked = 0 }) {
  const wallet = await ensureWallet(base44, userId, coin);
  const nextAvailable = round(Number(wallet.available || 0) + available, coin);
  const nextLocked = round(Number(wallet.locked || 0) + locked, coin);
  if (nextAvailable < 0) throw new Error('INSUFFICIENT_FUNDS');
  if (nextLocked < 0) throw new Error('INSUFFICIENT_LOCKED');
  await base44.asServiceRole.entities.Wallet.update(wallet.id, {
    available: nextAvailable,
    locked: nextLocked,
  });
  return { available: nextAvailable, locked: nextLocked };
}

export async function recordLedger(base44, { userId, coin, amount, kind, description, balanceAfter, refId }) {
  return base44.asServiceRole.entities.LedgerEntry.create({
    user_id: userId,
    coin,
    amount,
    kind,
    description: description || '',
    balance_after: balanceAfter || 0,
    ref_id: refId || '',
  });
}

export async function getMatch(base44, matchId) {
  return base44.asServiceRole.entities.Match.get(matchId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
}