import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { COINS, handleFor, requireUser } from '../../shared/wallet.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    const existing = await base44.asServiceRole.entities.PlayerProfile.filter({ user_id: user.id });
    const rows = Array.isArray(existing) ? existing : existing.items || [];
    const current = rows[0] || null;

    // Heartbeat: the player is still on the page, keep their listing alive.
    if (body.heartbeat) {
      if (!current) return Response.json({ profile: null });
      const profile = await base44.asServiceRole.entities.PlayerProfile.update(current.id, { last_seen: now });
      return Response.json({ profile });
    }

    const text = (value, fallback) => {
      const clean = String(value ?? fallback ?? '').trim();
      return clean.slice(0, 80);
    };
    const coin = COINS.includes(String(body.coin || '').toUpperCase())
      ? String(body.coin).toUpperCase()
      : current?.coin || 'USDT';
    const stake = Math.max(0, Number(body.stake ?? current?.stake ?? 0) || 0);

    const patch = {
      user_id: user.id,
      handle: handleFor(user),
      xbox_gamertag: text(body.xbox_gamertag, current?.xbox_gamertag),
      psn_id: text(body.psn_id, current?.psn_id),
      steam_id: text(body.steam_id, current?.steam_id),
      platform: text(body.platform, current?.platform) || 'Xbox',
      game_slug: text(body.game_slug, current?.game_slug) || 'cod',
      coin,
      stake,
      looking: Boolean(body.looking),
      looking_note: text(body.looking_note, current?.looking_note),
      last_seen: now,
    };

    const profile = current
      ? await base44.asServiceRole.entities.PlayerProfile.update(current.id, patch)
      : await base44.asServiceRole.entities.PlayerProfile.create(patch);

    return Response.json({ profile });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}