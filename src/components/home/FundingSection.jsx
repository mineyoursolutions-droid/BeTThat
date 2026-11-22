import { ShieldCheck } from 'lucide-react';
import CoinMark from '@/components/CoinMark';
import SectionHeading from '@/components/SectionHeading';
import { COINS } from '@/lib/demo';

export default function FundingSection() {
  return (
    <section className="border-y border-border bg-ink">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
          <SectionHeading
            eyebrow="Funding"
            title="Four coins. No exchange in the middle."
            description="Your stake sits in your own account balance until you back a match. Every deposit and payout is matched to an on-chain transaction."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {COINS.map((coin) => (
              <div
                key={coin.ticker}
                className="group flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-4 transition hover:border-primary/35"
              >
                <CoinMark ticker={coin.ticker} size="lg" />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-foreground">
                    {coin.name} <span className="text-muted-foreground">·</span>{' '}
                    <span className="nums text-muted-foreground">{coin.ticker}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{coin.network}</p>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3.5 sm:col-span-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Deposits credit only after on-chain confirmation and a hash check. Withdrawals are reviewed and released
                by the operator to the address you nominate.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}