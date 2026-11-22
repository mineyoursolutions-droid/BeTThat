import { gameBySlug, round } from '@/lib/demo';

const FALLBACK_GAME = {
  slug: 'match',
  name: 'Match',
  monogram: 'VS',
  gradient: 'from-slate-500/30 via-slate-600/10 to-transparent',
};

export const gameLook = (slug) => gameBySlug(slug) || { ...FALLBACK_GAME, name: slug || 'Match' };

export const oddsFor = (match) => {
  const pc = Number(match.spectator_pool_creator || 0);
  const pch = Number(match.spectator_pool_challenger || 0);
  const total = pc + pch;
  if (total <= 0) return { creator: 1.9, challenger: 1.9 };
  const calc = (pool) => {
    if (pool <= 0) return 9.99;
    return Math.min(9.99, Math.max(1.01, Math.round(((total * 0.95) / pool) * 100) / 100));
  };
  return { creator: calc(pc), challenger: calc(pch) };
};

export const projectedPayout = (match, side, amount) => {
  const value = Number(amount || 0);
  if (!(value > 0)) return 0;
  const pc = Number(match.spectator_pool_creator || 0);
  const pch = Number(match.spectator_pool_challenger || 0);
  const winPool = (side === 'creator' ? pc : pch) + value;
  const losePool = side === 'creator' ? pch : pc;
  const total = winPool + losePool;
  return round((value / winPool) * total * 0.95, match.coin);
};

export const statusLabel = (status) =>
  ({
    open: 'Open',
    matched: 'Matched',
    in_play: 'In play',
    awaiting_result: 'Awaiting result',
    settled: 'Settled',
    cancelled: 'Cancelled',
  }[status] || status);

export const toCardView = (match) => ({
  id: match.id,
  game: match.game_slug,
  title: match.title,
  detail: [match.ruleset, match.platform, match.region].filter(Boolean).join(' · '),
  stake: { amount: match.stake, ticker: match.coin },
  creator: { handle: match.creator_handle || 'Creator', record: 'creator' },
  challenger: match.challenger_id
    ? { handle: match.challenger_handle || 'Challenger', record: 'challenger' }
    : null,
  market: oddsFor(match),
  spectators: match.spectator_count || 0,
  status: match.status,
  raw: match,
});