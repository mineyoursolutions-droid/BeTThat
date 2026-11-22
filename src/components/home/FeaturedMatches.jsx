import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import MatchCard from '@/components/MatchCard';
import SectionHeading from '@/components/SectionHeading';
import { toCardView } from '@/lib/matches';

const FILTERS = [
  { id: 'all', label: 'All matches' },
  { id: 'open', label: 'Open to challengers' },
  { id: 'matched', label: 'Matched' },
  { id: 'in_play', label: 'In play' },
];

export default function FeaturedMatches({ matches }) {
  const [filter, setFilter] = useState('all');
  const cards = (matches || []).map(toCardView);
  const shown = cards.filter((m) => filter === 'all' || m.status === filter);

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <SectionHeading
        eyebrow="The book is open"
        title="Live and open stakes right now"
        description="Real stakes, real players. Take a side as a competitor or ride the spectator market."
      />

      <div className="no-scrollbar -mx-5 mt-8 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
              filter === f.id
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {matches === null ? (
        <div className="mt-5 grid gap-3.5 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <p className="text-[15px] font-semibold text-foreground">The book is empty in this filter.</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            Post the first challenge and set the stake yourself.
          </p>
          <Link
            to="/create"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
            Post a challenge
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-3.5 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shown.slice(0, 6).map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}

      <Link to="/lobby" className="group mt-8 inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
        See all matches
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </Link>
    </section>
  );
}