export function reputationTier(score, matches) {
  if (!matches) return 'Unrated';
  if (score >= 80) return 'Elite';
  if (score >= 65) return 'Gold';
  if (score >= 50) return 'Silver';
  return 'Bronze';
}

export function reputationSummary(profile) {
  const matches = Number(profile?.matches_played || 0);
  const won = Number(profile?.matches_won || 0);
  const disputes = Number(profile?.disputes || 0);
  const score = matches ? Number(profile?.reputation ?? 50) : 50;

  return {
    score,
    matches,
    won,
    lost: Math.max(0, matches - won),
    disputes,
    tier: reputationTier(score, matches),
  };
}

export const TIER_STYLES = {
  Elite: 'border-primary/40 bg-primary/10 text-primary',
  Gold: 'border-chart-3/40 bg-chart-3/10 text-chart-3',
  Silver: 'border-border bg-secondary text-foreground',
  Bronze: 'border-live/30 bg-live/10 text-live',
  Unrated: 'border-dashed border-border bg-transparent text-muted-foreground',
};