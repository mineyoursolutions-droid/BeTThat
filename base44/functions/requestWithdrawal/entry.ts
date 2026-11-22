import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { COINS, round, handleFor, requireUser, moveFunds, recordLedger } from '../../shared/wallet.ts';

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