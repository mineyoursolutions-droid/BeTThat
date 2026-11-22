import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { fmtUsd, toUsd } from '@/lib/demo';
import { CHART, tooltipStyle } from '@/lib/chartTheme';

export default function FormBars({ results }) {
  const data = results.slice(-8).map((r, i) => ({
    name: `#${i + 1}`,
    title: r.title,
    value: Number(toUsd(r.net, r.coin).toFixed(2)),
    won: r.won,
  }));

  return (
    <div className="h-[68px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="24%">
          <XAxis dataKey="name" hide />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(value) => [fmtUsd(value), 'Net']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.title || ''}
          />
          <Bar dataKey="value" radius={[3, 3, 3, 3]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.won ? CHART.win : CHART.loss} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}