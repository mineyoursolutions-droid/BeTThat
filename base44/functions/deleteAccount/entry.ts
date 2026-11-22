// deleteAccount — permanently removes the signed-in user's app data.
//
// Safety rules (no settlement / escrow logic is touched):
//  - Blocked, with a clear reason, while the user has locked escrow funds,
//    a positive wallet balance, an open/locked wager, an open or in-play
//    match they are part of, or an open console room / prop bet.
//  - Otherwise deletes the user's own records: PlayerProfile, Wallet,
//    LedgerEntry, DepositAddress, CryptoTransaction, MatchMessage, TrashTalk,
//    PropBet (settled only, by the block above), ConsoleRoom (hosted, closed
//    only) and their player-side Wagers.
//  - Matches the user played in that are already settled/cancelled are NOT
//    deleted — the other side's record must stay verifiable. Their handles
//    are anonymised to "Deleted player" instead.
//  - The Base44 platform identity itself has no delete API in the SDK, so
//    the frontend signs the user out after this succeeds; the dialog tells
//    the user to contact support to erase the underlying identity.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireUser } from '../../shared/wallet.ts';

async function listAll(base44, entity, filter) {
  // Same single-page pattern the rest of the codebase uses (see
  // shared/wallet.ts asRows): one filter call, up to 500 rows. A single
  // user's own records realistically stay well under that.
  const res = await base44.asServiceRole.entities[entity].filter(filter, { limit: 500 });
  if (Array.isArray(res)) return res;
  return (res && res.items) || [];
}

async function deleteRows(base44, entity, rows) {
  let deleted = 0;
  for (const row of rows) {
    try {
      await base44.asServiceRole.entities[entity].delete(row.id);
      deleted += 1;
    } catch {
      // A row that is already gone (or not deletable) must not fail the
      // whole deletion; the count simply reflects what was removed.
    }
  }
  return deleted;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user.id;

    // ---- Blocking checks: never delete while money or matches are live. ----
    const wallets = await listAll(base44, 'Wallet', { user_id: userId });
    const locked = wallets.filter((w) => Number(w.locked || 0) > 0);
    if (locked.length) {
      return Response.json(
        { error: 'You still have funds locked in escrow. Wait for your open matches to settle, then withdraw before deleting your account.' },
        { status: 400 },
      );
    }
    const funded = wallets.filter((w) => Number(w.available || 0) > 0);
    if (funded.length) {
      return Response.json(
        { error: 'Your wallet still has a balance. Withdraw your funds first, then delete your account.' },
        { status: 400 },
      );
    }

    const wagers = await listAll(base44, 'Wager', { user_id: userId });
    const openWagers = wagers.filter((w) => w.status === 'locked');
    if (openWagers.length) {
      return Response.json(
        { error: 'You still have open wagers. Wait for those matches to settle or be cancelled before deleting your account.' },
        { status: 400 },
      );
    }

    const myMatches = await listAll(base44, 'Match', { creator_id: userId });
    const theirMatches = await listAll(base44, 'Match', { challenger_id: userId });
    const liveMatches = [...myMatches, ...theirMatches].filter((m) =>
      ['open', 'matched', 'in_play'].includes(m.status),
    );
    if (liveMatches.length) {
      return Response.json(
        { error: 'You still have an open or in-play match. Wait for it to settle or be cancelled before deleting your account.' },
        { status: 400 },
      );
    }

    const rooms = await listAll(base44, 'ConsoleRoom', { host_id: userId });
    if (rooms.some((r) => r.status !== 'closed')) {
      return Response.json(
        { error: 'You still have an open console room. Close it first, then delete your account.' },
        { status: 400 },
      );
    }

    const propBets = await listAll(base44, 'PropBet', { user_id: userId });
    if (propBets.some((b) => b.status === 'open' || b.status === 'locked')) {
      return Response.json(
        { error: 'You still have open prop bets. Wait for those markets to resolve before deleting your account.' },
        { status: 400 },
      );
    }

    // ---- Deletion (only after every block above has passed). ----
    const deleted = {};
    deleted.player_profiles = await deleteRows(base44, 'PlayerProfile', await listAll(base44, 'PlayerProfile', { user_id: userId }));
    deleted.wallets = await deleteRows(base44, 'Wallet', wallets);
    deleted.ledger_entries = await deleteRows(base44, 'LedgerEntry', await listAll(base44, 'LedgerEntry', { user_id: userId }));
    deleted.deposit_addresses = await deleteRows(base44, 'DepositAddress', await listAll(base44, 'DepositAddress', { user_id: userId }));
    deleted.crypto_transactions = await deleteRows(base44, 'CryptoTransaction', await listAll(base44, 'CryptoTransaction', { user_id: userId }));
    deleted.match_messages = await deleteRows(base44, 'MatchMessage', await listAll(base44, 'MatchMessage', { sender_id: userId }));
    deleted.trash_talk = await deleteRows(base44, 'TrashTalk', await listAll(base44, 'TrashTalk', { user_id: userId }));
    deleted.prop_bets = await deleteRows(base44, 'PropBet', propBets);
    deleted.console_rooms = await deleteRows(base44, 'ConsoleRoom', rooms);
    deleted.wagers = await deleteRows(base44, 'Wager', wagers);
    deleted.matches_created = await deleteRows(
      base44,
      'Match',
      myMatches.filter((m) => ['settled', 'cancelled'].includes(m.status) && !m.challenger_id),
    );

    // Settled/cancelled matches involving another player stay, anonymised.
    let anonymised = 0;
    for (const m of [...myMatches, ...theirMatches]) {
      if (!['settled', 'cancelled'].includes(m.status)) continue;
      const patch = {};
      if (m.creator_id === userId) patch.creator_handle = 'Deleted player';
      if (m.challenger_id === userId) patch.challenger_handle = 'Deleted player';
      if (!Object.keys(patch).length) continue;
      try {
        await base44.asServiceRole.entities.Match.update(m.id, patch);
        anonymised += 1;
      } catch {
        // Best effort — the record itself remains.
      }
    }
    deleted.anonymised_matches = anonymised;

    return Response.json({ ok: true, deleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
