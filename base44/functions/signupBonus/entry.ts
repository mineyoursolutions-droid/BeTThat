import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  SIGNUP_BONUS_AMOUNT,
  SIGNUP_BONUS_COIN,
  SIGNUP_BONUS_DESCRIPTION,
  getSignupBonusState,
  requireUser,
  moveFunds,
  recordLedger,
} from '../../shared/wallet.ts';

// $25 sign-up bonus in USDT, wager-only, one per account.
//
// Actions (body.action):
// - "status" (default): returns the caller's bonus state without
//   changing anything: { claimed, wagered, amount, coin, claimed_at }.
// - "claim": credits the bonus once. Idempotent: if a bonus ledger
//   entry already exists for this account, the existing state is
//   returned and nothing is credited again — safe to call on every
//   sign-in, from registration, and from the Wallet claim button.
//
// The bonus is wager-only: requestWithdrawal blocks withdrawing the
// bonus amount until getSignupBonusState reports wagered=true (at
// least one stake ledger entry dated at/after the claim).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');

    const state = await getSignupBonusState(base44, user.id);

    if (action === 'status') {
      return Response.json({ bonus: state });
    }

    if (action !== 'claim') {
      return Response.json({ error: 'Unknown action.' }, { status: 400 });
    }

    if (state.claimed) {
      return Response.json({ bonus: state, alreadyClaimed: true });
    }

    // Credit the bonus into the player's USDT wallet. moveFunds throws
    // only on negative balances, which cannot happen on a credit.
    const wallet = await moveFunds(base44, user.id, SIGNUP_BONUS_COIN, {
      available: SIGNUP_BONUS_AMOUNT,
    });

    await recordLedger(base44, {
      userId: user.id,
      coin: SIGNUP_BONUS_COIN,
      amount: SIGNUP_BONUS_AMOUNT,
      kind: 'deposit',
      description: SIGNUP_BONUS_DESCRIPTION,
      balanceAfter: wallet.available,
      refId: '',
    });

    const claimed = await getSignupBonusState(base44, user.id);
    return Response.json({ bonus: claimed, alreadyClaimed: false });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
