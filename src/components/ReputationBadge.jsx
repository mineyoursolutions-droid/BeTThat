import { ShieldCheck } from 'lucide-react';
import { reputationSummary, TIER_STYLES } from '@/lib/reputation';

export default function ReputationBadge({ profile, className = '' }) {
  const stats = reputationSummary(profile);
  const styles = TIER_STYLES[stats.tier];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-bold uppercase tracking-[0.08em] ${styles} ${className}`}
      title={
        stats.matches
          ? `${stats.won}W · ${stats.lost}L · ${stats.disputes} disputed of ${stats.matches} settled`
          : 'No settled matches yet'
      }
    >
      <ShieldCheck className="h-3 w-3" />
      {stats.tier === 'Unrated' ? 'Unrated' : `${stats.score} ${stats.tier}`}
    </span>
  );
}

export function RecordLine({ profile, className = '' }) {
  const stats = reputationSummary(profile);
  if (!stats.matches) return null;
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      <span className="nums font-semibold text-foreground">{stats.won}W</span>
      <span className="mx-1 text-border">·</span>
      <span className="nums font-semibold text-foreground">{stats.lost}L</span>
      {stats.disputes ? (
        <>
          <span className="mx-1 text-border">·</span>
          <span className="nums font-semibold text-live">{stats.disputes} disputed</span>
        </>
      ) : null}
    </p>
  );
}