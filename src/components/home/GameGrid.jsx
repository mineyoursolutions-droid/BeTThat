import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';
import { GAMES } from '@/lib/demo';
import { useTilt } from '@/hooks/useTilt';

function GameTile({ game, count }) {
  // 3D pointer tilt (desktop hover only, off under reduced motion).
  const tilt = useTilt(7);
  return (
    <Link
      key={game.slug}
      to={`/lobby?game=${game.slug}`}
      {...tilt}
      className="tilt group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition duration-300 hover:border-primary/50 sm:p-5"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${game.gradient} opacity-50 transition duration-500 group-hover:opacity-100`}
      />
      <div className="tilt-lift relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.03em] text-foreground/90 sm:text-[26px]">
            {game.monogram}
          </span>
          <ArrowUpRight className="h-4 w-4 text-foreground/60 opacity-0 transition group-hover:opacity-100" />
        </div>

        <div className="mt-12 sm:mt-14">
          <p className="truncate text-sm font-semibold text-foreground">{game.name}</p>
          <p className="truncate text-sm text-muted-foreground">{game.subtitle}</p>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
          <span className="truncate text-sm uppercase tracking-[0.1em] text-muted-foreground">
            {game.platforms.join(' · ')}
          </span>
          <span className="nums shrink-0 text-sm font-semibold text-foreground/80">{count || 0}</span>
        </div>
      </div>
    </Link>
  );
}

export default function GameGrid({ counts }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <SectionHeading
        eyebrow="Game catalogue"
        title="Every title worth arguing about"
        description="Console and cross-play lobbies, one book. Filters for platform, ruleset and stake live inside the lobby."
        actionLabel="Open the lobby"
        actionTo="/lobby"
      />

      <div className="stagger-children mt-10 grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
        {GAMES.map((game) => (
          <GameTile key={game.slug} game={game} count={counts && counts[game.slug]} />
        ))}
      </div>
    </section>
  );
}