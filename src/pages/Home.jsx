import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Hero from '@/components/home/Hero';
import StatsStrip from '@/components/home/StatsStrip';
import FeaturedMatches from '@/components/home/FeaturedMatches';
import GameGrid from '@/components/home/GameGrid';
import HowItWorks from '@/components/home/HowItWorks';
import LeaderboardPreview from '@/components/home/LeaderboardPreview';
import FundingSection from '@/components/home/FundingSection';
import { GAMES } from '@/lib/demo';

export default function Home() {
  const [matches, setMatches] = useState(null);

  useEffect(() => {
    let active = true;
    base44.entities.Match
      .list({ sort: '-created_date', limit: 60 })
      .then((page) => {
        if (active) setMatches(page.items || []);
      })
      .catch(() => {
        if (active) setMatches([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const counts = {};
  (matches || []).forEach((m) => {
    if (m.status === 'open') counts[m.game_slug] = (counts[m.game_slug] || 0) + 1;
  });
  GAMES.forEach((g) => {
    if (counts[g.slug] === undefined) counts[g.slug] = 0;
  });

  return (
    <>
      <Hero />
      <StatsStrip />
      <FeaturedMatches matches={matches} />
      <GameGrid counts={counts} />
      <HowItWorks />
      <LeaderboardPreview />
      <FundingSection />

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="relative overflow-hidden rounded-[1.5rem] border border-border bg-card px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-primary/12 blur-[110px]" />
          </div>
          <div className="relative mx-auto max-w-xl">
            <h2 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[38px]">
              Somebody is always waiting for a match.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-muted-foreground">
              Fund a balance, post your ruleset, and let the lobby send you a challenger.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/create"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground transition hover:brightness-105"
              >
                Post a challenge
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/lobby"
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-[14px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
              >
                Browse open stakes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}