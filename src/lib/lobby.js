export const BUCKETS = [
  { id: 'active', label: 'Active', statuses: ['open', 'matched', 'in_play'] },
  { id: 'pending', label: 'Pending', statuses: ['awaiting_result'] },
  { id: 'completed', label: 'Completed', statuses: ['settled', 'cancelled'] },
  { id: 'all', label: 'All', statuses: [] },
];

export const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'title', label: 'Game A–Z' },
  { id: 'stake_desc', label: 'Stake high' },
  { id: 'stake_asc', label: 'Stake low' },
];

const bucketOf = (id) => BUCKETS.find((b) => b.id === id) || BUCKETS[0];

export function bucketMatches(matches, bucket) {
  const statuses = bucketOf(bucket).statuses;
  if (!statuses.length) return matches || [];
  return (matches || []).filter((m) => statuses.includes(m.status));
}

export function countBuckets(matches, { gameFilter, coin }) {
  const scoped = (matches || []).filter(
    (m) =>
      (gameFilter === 'all' || m.game_slug === gameFilter) &&
      (coin === 'all' || m.coin === coin),
  );
  return BUCKETS.reduce((acc, b) => {
    acc[b.id] = bucketMatches(scoped, b.id).length;
    return acc;
  }, {});
}

export function applyLobbyView(matches, { gameFilter, bucket, coin, sort }) {
  const rows = bucketMatches(matches, bucket).filter(
    (m) =>
      (gameFilter === 'all' || m.game_slug === gameFilter) &&
      (coin === 'all' || m.coin === coin),
  );

  if (sort === 'title') {
    return rows.sort((a, b) =>
      String(a.game_name || a.title || '').localeCompare(String(b.game_name || b.title || '')),
    );
  }
  if (sort === 'stake_desc') return rows.sort((a, b) => Number(b.stake || 0) - Number(a.stake || 0));
  if (sort === 'stake_asc') return rows.sort((a, b) => Number(a.stake || 0) - Number(b.stake || 0));
  return rows;
}