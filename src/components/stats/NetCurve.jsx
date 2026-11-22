import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtUsd, toUsd } from '@/lib/demo';
import { CHART, tooltipStyle } from '@/lib/chartTheme';

export default function NetCurve({ results }) {
  let running = 0;
  const data = results.map((r, i) => {
    running += toUsd(r.net, r.coin);
    return {
      name: `#${i + 1}`,
      title: r.title,
      value: Number(running.toFixed(2)),
      won: r.won,
    };
  });

  if (!data.length) return null;

  const positive = running >= 0;
  const stroke = positive ? CHART.win : CHART.loss;

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: CHART.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: CHART.muted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={54}
            tickFormatter={(v) => fmtUsd(v)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [fmtUsd(value), 'Cumulative']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.title || ''}
          />
          <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} fill="url(#netFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}