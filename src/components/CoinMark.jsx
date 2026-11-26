import { Bitcoin } from 'lucide-react';
import { coinByTicker } from '@/lib/demo';

const SIZES = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-11 w-11',
};

const GLYPHS = { BTC: null, ETH: 'Ξ', USDT: '₮', USDC: '$', PLAY: '⛓' };

export default function CoinMark({ ticker, size = 'md', className = '' }) {
  const coin = coinByTicker(ticker);
  const accent = coin ? coin.accent : '#94A3B8';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${SIZES[size]} ${className}`}
      style={{ backgroundColor: `${accent}1f`, color: accent, borderColor: `${accent}33` }}
      aria-label={ticker}
    >
      {ticker === 'BTC' ? (
        <Bitcoin className="h-[60%] w-[60%]" strokeWidth={2.4} />
      ) : (
        <span className="font-mono text-sm font-bold leading-none">{GLYPHS[ticker] || ticker[0]}</span>
      )}
    </span>
  );
}