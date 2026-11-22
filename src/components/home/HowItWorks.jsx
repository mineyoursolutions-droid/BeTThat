import { Wallet, Swords, Trophy } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';

const STEPS = [
  {
    icon: Wallet,
    step: '01',
    title: 'Fund with crypto',
    body: 'Send BTC, USDT, USDC or ETH to your account address and submit the transaction hash. Your balance is credited once the transfer confirms on chain.',
  },
  {
    icon: Swords,
    step: '02',
    title: 'Post or accept a match',
    body: 'Pick the title, ruleset and stake. A challenger matches your amount, both stakes lock in escrow, and the match goes live in the lobby.',
  },
  {
    icon: Trophy,
    step: '03',
    title: 'Settle and get paid',
    body: 'Submit the result with proof. An operator verifies it and the ledger releases the pot straight to the winner — spectators settle the same way.',
  },
];

export default function HowItWorks() {
  return (
    <section className="border-y border-border bg-ink">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="A book with no middleman guesswork"
          description="Every stake, payout and refund is written to a ledger you can read from your own account."
        />

        <div className="mt-10 grid gap-3.5 sm:gap-4 lg:grid-cols-3">
          {STEPS.map(({ icon: Icon, step, title, body }) => (
            <div key={step} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 card-sheen">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-background/70 text-primary">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span className="nums text-[11px] font-semibold tracking-[0.2em] text-muted-foreground/60">{step}</span>
              </div>
              <h3 className="mt-6 text-[16px] font-semibold text-foreground">{title}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}