import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { fmtUsd, toUsd } from '@/lib/demo';
import { CHART, tooltipStyle } from '@/lib/chartTheme';

export default function ResultBars({ results }) {
  const data = results.slice(-16).map((r, i) => ({
    name: `#${i + 1}`,
    title: r.title,
    value: Number(toUsd(r.net, r.coin).toFixed(2)),
    won: r.won,
  }));

  if (!data.length) return null;

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="name" tick={{ fill: CHART.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke={CHART.grid} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(value) => [fmtUsd(value), 'Result']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.title || ''}
          />
          <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={34}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.won ? CHART.win : CHART.loss} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}