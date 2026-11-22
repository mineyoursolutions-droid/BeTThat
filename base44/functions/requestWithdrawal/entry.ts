import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  COINS,
  round,
  handleFor,
  requireUser,
  moveFunds,
  recordLedger,
  getSignupBonusState,
  withdrawableBalance,
  SIGNUP_BONUS_COIN,
} from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const coin = String(body.coin || '').toUpperCase();
    const amount = round(Number(body.amount || 0), coin);
    const address = String(body.address || '').trim();

    if (!COINS.includes(coin)) return Response.json({ error: 'Unsupported coin.' }, { status: 400 });
    if (!(amount > 0)) return Response.json({ error: 'Enter an amount to withdraw.' }, { status: 400 });
    if (address.length < 12) {
      return Response.json({ error: 'Enter the wallet address to pay out to.' }, { status: 400 });
    }

    // Wager-only sign-up bonus: while the $25 USDT bonus is un-wagered,
    // the bonus amount itself cannot be withdrawn (the rest of the
    // balance can). The bonus unlocks for withdrawal after the player
    // places at least one wager after claiming it.
    if (coin === SIGNUP_BONUS_COIN) {
      const bonus = await getSignupBonusState(base44, user.id);
      if (bonus.claimed && !bonus.wagered) {
        const walletRow = await base44.asServiceRole.entities.Wallet.filter({
          user_id: user.id,
          coin,
        }).then((res) => (Array.isArray(res) ? res[0] : (res.items || [])[0]));
        const withdrawable = withdrawableBalance(walletRow ? walletRow.available : 0, bonus);
        if (amount > withdrawable) {
          return Response.json(
            {
              error: `Your $25 sign-up bonus is wager-only. Place a wager first to unlock it for withdrawal — you can withdraw up to ${withdrawable} ${coin} right now.`,
            },
            { status: 400 },
          );
        }
      }
    }

    let wallet;
    try {
      wallet = await moveFunds(base44, user.id, coin, { available: -amount, locked: amount });
    } catch (err) {
      return Response.json({ error: 'That is more than your available balance.' }, { status: 400 });
    }

    const transaction = await base44.asServiceRole.entities.CryptoTransaction.create({
      user_id: user.id,
      user_handle: handleFor(user),
      kind: 'withdrawal',
      coin,
      amount,
      tx_hash: '',
      address,
      status: 'pending',
      review_note: '',
      reviewed_by: '',
    });

    await recordLedger(base44, {
      userId: user.id,
      coin,
      amount: -amount,
      kind: 'withdrawal_hold',
      description: 'Withdrawal requested · held for review',
      balanceAfter: wallet.available,
      refId: transaction.id,
    });

    return Response.json({ transaction });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}