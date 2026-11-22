import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { COINS, round, handleFor, requireUser } from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const coin = String(body.coin || '').toUpperCase();
    const amount = round(Number(body.amount || 0), coin);
    const txHash = String(body.tx_hash || '').trim();

    if (!COINS.includes(coin)) return Response.json({ error: 'Unsupported coin.' }, { status: 400 });
    if (!(amount > 0)) return Response.json({ error: 'Enter the amount you sent.' }, { status: 400 });
    if (txHash.length < 10) {
      return Response.json({ error: 'Paste the full transaction hash from your wallet.' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.CryptoTransaction.filter({ tx_hash: txHash });
    const rows = Array.isArray(existing) ? existing : existing.items || [];
    if (rows.length) {
      return Response.json({ error: 'That transaction hash is already on file.' }, { status: 400 });
    }

    const transaction = await base44.asServiceRole.entities.CryptoTransaction.create({
      user_id: user.id,
      user_handle: handleFor(user),
      kind: 'deposit',
      coin,
      amount,
      tx_hash: txHash,
      address: '',
      status: 'pending',
      review_note: '',
      reviewed_by: '',
    });

    return Response.json({ transaction });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}