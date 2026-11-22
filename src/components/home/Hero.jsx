import { useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Scale, Timer } from 'lucide-react';
import HeroTicket from '@/components/home/HeroTicket';

const TRUST = [
  { icon: ShieldCheck, label: 'Stakes held in escrow' },
  { icon: Scale, label: 'Operator-verified payouts' },
  { icon: Timer, label: 'Settled within minutes' },
];

export default function Hero() {
  const sectionRef = useRef(null);

  // Pointer parallax: sets --px / --py (-1..1) on the section; the
  // .plx-* layers drift at different rates for layered depth.
  // Fine pointers only, off under prefers-reduced-motion.
  const onPointerMove = useCallback((event) => {
    const el = sectionRef.current;
    if (!el || event.pointerType === 'touch') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--px', (((event.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
    el.style.setProperty('--py', (((event.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
  }, []);

  return (
    <section ref={sectionRef} onPointerMove={onPointerMove} className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0">
        <div className="plx plx-slow absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-primary/20 blur-[130px]" />
        <div className="plx plx-mid absolute -bottom-56 right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-neon-pink/[0.18] blur-[140px]" />
        <div className="orb orb-1 left-[12%] top-[18%] h-24 w-24 bg-neon-lime/45" />
        <div className="orb orb-2 right-[16%] top-[8%] h-16 w-16 bg-neon-cyan/45" />
        <div className="orb orb-3 bottom-[10%] left-[46%] h-14 w-14 bg-neon-pink/45" />
        <div className="brick-wall absolute inset-0 opacity-60" />
        <div
          className="plx plx-fast absolute inset-0 opacity-[0.5]"
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
          <div className="tag-sticker rounded-full px-3 py-1.5 text-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" />
            </span>
            <span className="font-semibold uppercase tracking-[0.16em]">
              PS5 · Xbox · Switch · 46 regions
            </span>
          </div>

          <h1 className="hero-headline mt-6 text-[2.6rem] font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-[3.6rem] lg:text-[4.1rem]">
            <span className="neon-sign-cyan">Stake the match.</span>
            <br />
            <span className="font-graffiti neon-sign-lime">Own the outcome.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-[16px]">
            Head-to-head wagers on Call of Duty, NBA 2K, Wii pool and every title worth arguing about. Players put up the
            stake, spectators take a side, and the winner is paid in BTC, USDT, USDC or ETH.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/lobby"
              className="btn-depth group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground"
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

        <div className="hero-fade hero-fade-delay plx plx-mid">
          <HeroTicket />
        </div>
      </div>
    </section>
  );
}