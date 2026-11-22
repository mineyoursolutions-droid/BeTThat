import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser, moveFunds, recordLedger } from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const transactionId = String(body.transaction_id || '').trim();
    const action = body.action === 'reject' ? 'reject' : 'approve';
    const note = String(body.note || '').trim();

    if (!transactionId) return Response.json({ error: 'transaction_id is required' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.CryptoTransaction.get(transactionId).catch((e) =>
      e.status === 404 ? null : Promise.reject(e),
    );
    if (!tx) return Response.json({ error: 'Transaction not found' }, { status: 404 });
    const reviewable = ['pending', 'failed', 'expired'];
    if (!reviewable.includes(tx.status)) {
      return Response.json({ error: 'This transaction has already been reviewed.' }, { status: 400 });
    }

    const coin = tx.coin;
    const amount = Number(tx.amount) || 0;
    let wallet;

    if (tx.kind === 'deposit') {
      if (action === 'approve') {
        // a deposit the chain check already credited must never be credited twice
        const prior = await base44.asServiceRole.entities.LedgerEntry.filter({ ref_id: tx.id, kind: 'deposit' });
        const priorRows = Array.isArray(prior) ? prior : prior.items || [];
        if (!priorRows.length) {
          wallet = await moveFunds(base44, tx.user_id, coin, { available: amount });
          await recordLedger(base44, {
            userId: tx.user_id,
            coin,
            amount,
            kind: 'deposit',
            description: 'Deposit confirmed on chain',
            balanceAfter: wallet.available,
            refId: tx.id,
          });
        }
        await base44.asServiceRole.entities.CryptoTransaction.update(tx.id, { credited: true });
      }
    } else if (action === 'approve') {
      wallet = await moveFunds(base44, tx.user_id, coin, { locked: -amount });
      await recordLedger(base44, {
        userId: tx.user_id,
        coin,
        amount: 0,
        kind: 'withdrawal',
        description: `Withdrawal released to ${tx.address}`,
        balanceAfter: wallet.available,
        refId: tx.id,
      });
    } else {
      wallet = await moveFunds(base44, tx.user_id, coin, { locked: -amount, available: amount });
      await recordLedger(base44, {
        userId: tx.user_id,
        coin,
        amount,
        kind: 'refund',
        description: 'Withdrawal declined · funds returned',
        balanceAfter: wallet.available,
        refId: tx.id,
      });
    }

    let status;
    if (tx.kind === 'deposit') status = action === 'approve' ? 'confirmed' : 'rejected';
    else status = action === 'approve' ? 'paid' : 'rejected';

    const updated = await base44.asServiceRole.entities.CryptoTransaction.update(tx.id, {
      status,
      review_note: note,
      reviewed_by: user.email || user.id,
    });

    return Response.json({ transaction: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}