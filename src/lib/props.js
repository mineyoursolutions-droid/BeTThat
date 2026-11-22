export const propOdds = (market) => {
  const yes = Number(market.yes_pool || 0);
  const no = Number(market.no_pool || 0);
  const total = yes + no;
  if (total <= 0) return { yes: 1.9, no: 1.9 };
  const calc = (pool) => {
    if (pool <= 0) return 9.99;
    return Math.min(9.99, Math.max(1.01, Math.round(((total * 0.95) / pool) * 100) / 100));
  };
  return { yes: calc(yes), no: calc(no) };
};

export const propState = (market) => {
  if (market.status === 'void') return { label: 'Void · refunded', tone: 'muted' };
  if (market.status === 'resolved') {
    return market.result === 'yes'
      ? { label: 'Resolved · Yes', tone: 'win' }
      : { label: 'Resolved · No', tone: 'loss' };
  }
  return { label: 'Open', tone: 'open' };
};