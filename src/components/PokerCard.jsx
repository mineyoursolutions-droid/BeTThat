import { Spade, Heart, Diamond, Club } from 'lucide-react';

// One playing card. `card` is a two-character code: rank + suit,
// e.g. "As", "Kd", "Qh", "Jc", "Ts", "9h". Face-down cards render as
// a dark graffiti-style card back.
const SUIT_ICON = { s: Spade, h: Heart, d: Diamond, c: Club };
const SUIT_COLOR = { s: 'text-slate-900', h: 'text-rose-600', d: 'text-rose-600', c: 'text-slate-900' };

export function cardLabel(card) {
  if (!card) return '';
  return card[0] === 'T' ? '10' : card[0];
}

export default function PokerCard({ card = null, faceDown = false, size = 'md', dimmed = false }) {
  const sizes = {
    sm: 'h-11 w-8 text-[13px]',
    md: 'h-16 w-11 text-[17px]',
    lg: 'h-20 w-14 text-[21px]',
  };
  const box = sizes[size] || sizes.md;

  if (faceDown || !card) {
    return (
      <div
        className={`${box} flex items-center justify-center rounded-lg border border-primary/40 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black shadow-md ${
          dimmed ? 'opacity-40' : ''
        }`}
        aria-label="Face-down card"
      >
        <span className="font-graffiti text-[13px] font-bold text-primary/80">BT</span>
      </div>
    );
  }

  const suit = card[1];
  const Icon = SUIT_ICON[suit] || Spade;
  const color = SUIT_COLOR[suit] || 'text-slate-900';
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div
      className={`${box} relative rounded-lg border border-slate-300 bg-white shadow-md ${dimmed ? 'opacity-40' : ''}`}
      aria-label={`${cardLabel(card)} of ${suit === 's' ? 'spades' : suit === 'h' ? 'hearts' : suit === 'd' ? 'diamonds' : 'clubs'}`}
    >
      <span className={`absolute left-1 top-0.5 font-extrabold leading-none ${color}`}>{cardLabel(card)}</span>
      <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 ${color}`}>
        <Icon className={iconSize} fill="currentColor" />
      </span>
    </div>
  );
}
