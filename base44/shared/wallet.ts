export const COINS = ['BTC', 'ETH', 'USDT', 'USDC'];

export const HOUSE_FEE = 0.05;

// No-limit wagers: there is no maximum stake anywhere in the app. The
// only limits on a wager are that the stake must be greater than zero
// and the player must have the balance to cover it (enforced by
// moveFunds throwing INSUFFICIENT_FUNDS). Do not add a cap here.
export const NO_STAKE_LIMIT = true;

// $25 sign-up bonus, paid in USDT. Wager-only: it cannot be withdrawn
// until the player has placed at least one wager after claiming it.
// One bonus per account — enforced by getSignupBonusState/claim below,
// which treat the first "Sign-up bonus" ledger entry as the claim.
export const SIGNUP_BONUS_AMOUNT = 25;
export const SIGNUP_BONUS_COIN = 'USDT';
export const SIGNUP_BONUS_DESCRIPTION = 'Sign-up bonus · $25 USDT (wager-only)';

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

// Sign-up bonus state for one account, derived from the ledger (the
// source of truth, so a bonus can never be credited twice):
// - claimed: a "Sign-up bonus" ledger entry exists for this user.
// - wagered: a stake ledger entry exists dated at/after the bonus
//   claim, i.e. the player wagered at least once after claiming.
//   Stakes placed before the claim do not unlock the bonus.
export async function getSignupBonusState(base44, userId) {
  const bonusRows = await asRows(
    base44.asServiceRole.entities.LedgerEntry.filter(
      { user_id: userId, kind: 'deposit' },
      { sort: '-created_date', limit: 50 },
    ),
  );
  const bonus = bonusRows.find((e) => String(e.description || '').startsWith('Sign-up bonus'));
  if (!bonus) {
    return {
      claimed: false,
      wagered: false,
      amount: SIGNUP_BONUS_AMOUNT,
      coin: SIGNUP_BONUS_COIN,
      claimed_at: null,
    };
  }
  const stakeRows = await asRows(
    base44.asServiceRole.entities.LedgerEntry.filter(
      { user_id: userId, kind: 'stake' },
      { sort: '-created_date', limit: 1 },
    ),
  );
  const bonusAt = new Date(bonus.created_date || 0).getTime();
  const wagered =
    stakeRows.length > 0 && new Date(stakeRows[0].created_date || 0).getTime() >= bonusAt;
  return {
    claimed: true,
    wagered,
    amount: Number(bonus.amount || 0),
    coin: bonus.coin,
    claimed_at: bonus.created_date || null,
  };
}

// Amount of a coin balance that may be withdrawn right now. While the
// sign-up bonus is un-wagered, the bonus amount itself is locked out of
// withdrawals (the rest of the balance is free to withdraw).
export function withdrawableBalance(available, bonusState) {
  const availableNum = Number(available || 0);
  if (!bonusState || !bonusState.claimed || bonusState.wagered) return availableNum;
  return Math.max(0, round(availableNum - Number(bonusState.amount || 0), bonusState.coin));
}

export async function getMatch(base44, matchId) {
  return base44.asServiceRole.entities.Match.get(matchId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
}