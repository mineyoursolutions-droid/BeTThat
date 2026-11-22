import { fmtUsd } from '@/lib/demo';

export default function StatCards({ totals, stakedUsd, netUsd }) {
  const cards = [
    {
      label: 'Settled matches',
      value: String(totals.matches),
      hint: totals.active ? `${totals.active} still in play` : 'All time',
    },
    {
      label: 'Win rate',
      value: totals.matches ? `${Math.round(totals.winRate * 100)}%` : '—',
      hint: `${totals.wins}W · ${totals.losses}L`,
    },
    {
      label: 'Total wagered',
      value: fmtUsd(stakedUsd),
      hint: 'Stakes and spectator bets',
    },
    {
      label: 'Net result',
      value: `${netUsd >= 0 ? '+' : '-'}${fmtUsd(Math.abs(netUsd))}`,
      hint: totals.disputed ? `${totals.disputed} disputed` : 'After the 5% operator fee',
      tone: netUsd >= 0 ? 'text-win' : 'text-live',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm uppercase tracking-[0.16em] text-muted-foreground">{c.label}</p>
          <p className={`nums mt-2 text-[22px] font-bold tracking-[-0.03em] ${c.tone || 'text-foreground'}`}>
            {c.value}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}