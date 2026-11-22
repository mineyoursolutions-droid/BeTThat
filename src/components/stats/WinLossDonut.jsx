import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART, tooltipStyle } from '@/lib/chartTheme';

export default function WinLossDonut({ totals }) {
  const data = [
    { name: 'Wins', value: totals.wins, fill: CHART.win },
    { name: 'Losses', value: totals.losses, fill: CHART.loss },
  ].filter((d) => d.value > 0);

  if (!totals.matches) {
    return (
      <p className="grid h-[220px] place-items-center text-center text-[12px] text-muted-foreground">
        No settled matches yet.
      </p>
    );
  }

  return (
    <div className="relative h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none">
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value} matches`, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="text-center">
          <p className="nums text-[24px] font-bold leading-none tracking-[-0.03em]">
            {Math.round(totals.winRate * 100)}%
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">won</p>
        </div>
      </div>
    </div>
  );
}