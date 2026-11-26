import { Link } from 'react-router-dom';
import { ArrowRight, Spade } from 'lucide-react';
import chainGangIcon from '@/assets/chain-gang-poker-icon.svg';

// Home-page Chain Gang Poker banner — the one-tap way into live poker.
// The system shuffles and deals every hand server-side.
const GAMES = [
  { name: 'Bone Crusher', to: '/poker/bone-crusher' },
  { name: 'Tic Tac Toe', to: '/poker/tic-tac-toe' },
  { name: 'Straight High', to: '/poker/straight-high' },
  { name: 'Lowball', to: '/poker/lowball' },
  { name: 'Paduki', to: '/poker/paduki' },
  { name: 'Dead Seven', to: '/poker/dead-seven' },
];

export default function ChainGangPoker() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <div className="glass-concrete relative overflow-hidden rounded-[1.5rem] px-6 py-12 sm:px-12 sm:py-16">
        <div className="brick-wall pointer-events-none absolute inset-0 opacity-70" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[15%] top-0 h-64 w-[30rem] -translate-x-1/2 rounded-full bg-primary/12 blur-[110px]" />
          <div className="absolute bottom-0 right-[8%] h-40 w-40 rounded-full bg-neon-pink/15 blur-[80px]" />
        </div>
        <div className="relative flex flex-col gap-8 sm:flex-row sm:items-start">
          <img
            src={chainGangIcon}
            alt="Chain Gang Poker — neon barbed wire with a prison guard tower"
            className="h-24 w-24 shrink-0 rounded-2xl sm:h-28 sm:w-28"
          />
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-primary">
              <Spade className="h-4 w-4" />
              Live poker · System deals the cards
            </p>
            <h2 className="mt-3 font-graffiti text-[40px] leading-none text-foreground sm:text-[56px]">
              <span className="neon-sign-cyan">Chain Gang</span>{' '}
              <span className="neon-sign-lime">Poker</span>
            </h2>
            <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Six house games, one table. Pick a game, take a seat, and the system shuffles and deals your hand live
              — no dealer, no deck to trust. Buy in with BTC, ETH, USDT, or USDC, or play with virtual chips as a
              guest — no account needed.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {GAMES.map((game) => (
                <Link
                  key={game.to}
                  to={game.to}
                  className="rounded-full border border-border/80 bg-background/60 px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary"
                >
                  {game.name}
                </Link>
              ))}
            </div>

            <div className="mt-8">
              <Link
                to="/poker"
                className="btn-depth group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-[14px] font-semibold text-primary-foreground"
              >
                Play live poker
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
