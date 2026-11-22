import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Scale, Timer } from 'lucide-react';
import HeroTicket from '@/components/home/HeroTicket';

const TRUST = [
  { icon: ShieldCheck, label: 'Stakes held in escrow' },
  { icon: Scale, label: 'Operator-verified payouts' },
  { icon: Timer, label: 'Settled within minutes' },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute -bottom-56 right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-win/[0.07] blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--border)/0.35) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.35) 1px, transparent 1px)',
            backgroundSize: '78px 78px',
            maskImage: 'radial-gradient(circle at 30% 0%, black, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(circle at 30% 0%, black, transparent 72%)',
          }}
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-24">
        {/* CSS fade-up (hero-fade in index.css) replaces framer-motion here:
            same 550ms rise, but framer-motion no longer ships in the
            first-paint bundle. */}
        <div className="hero-fade">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              PS5 · Xbox · Switch · 46 regions
            </span>
          </div>

          <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-[3.6rem] lg:text-[4.1rem]">
            Stake the match.
            <br />
            <span className="text-primary">Own the outcome.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
            Head-to-head wagers on Call of Duty, NBA 2K, Wii pool and every title worth arguing about. Players put up the
            stake, spectators take a side, and the winner is paid in BTC, USDT, USDC or ETH.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/lobby"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground transition hover:brightness-105"
            >
              Browse the lobby
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-3 text-[14px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
            >
              Post a challenge
            </Link>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="hero-fade hero-fade-delay">
          <HeroTicket />
        </div>
      </div>
    </section>
  );
}