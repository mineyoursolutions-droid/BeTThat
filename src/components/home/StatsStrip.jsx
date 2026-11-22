import { COINS, GAMES } from '@/lib/demo';
import CountUp from '@/components/motion/CountUp';

const STATS = [
  { value: GAMES.length, suffix: '', label: 'Titles in the book' },
  { value: COINS.length, suffix: '', label: 'Coins accepted' },
  { value: 5, suffix: '%', label: 'Operator fee on the pot' },
  { value: null, suffix: '', label: 'Stakes held until verified', text: 'Escrow' },
];

export default function StatsStrip() {
  return (
    <section className="border-b border-border bg-ink">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-border px-5 sm:px-8 md:grid-cols-4 md:divide-x">
        {STATS.map((stat, i) => (
          <div key={stat.label} className={`px-1 py-7 md:px-6 ${i > 1 ? 'border-t border-border md:border-t-0' : ''}`}>
            <p className="nums neon-number text-[19px] font-semibold sm:text-[22px]">
              {stat.value === null ? stat.text : <CountUp value={stat.value} suffix={stat.suffix} />}
            </p>
            <p className="mt-1 text-sm uppercase tracking-[0.15em] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}