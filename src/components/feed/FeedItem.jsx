import { Link } from 'react-router-dom';
import { Trophy, Swords, Flame, Coins } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { fmtCoin } from '@/lib/demo';

const KINDS = {
  result: { Icon: Trophy, tone: 'win', amount: 'win' },
  challenge: { Icon: Swords, tone: 'primary', amount: 'primary' },
  live: { Icon: Flame, tone: 'live', amount: 'live' },
  wager: { Icon: Coins, tone: 'win', amount: 'win' },
};

const TONES = {
  win: 'border-win/30 bg-win/10 text-win',
  primary: 'border-primary/30 bg-primary/10 text-primary',
  live: 'border-live/30 bg-live/10 text-live',
};

function line(item) {
  if (item.kind === 'result') return [item.handle, ' took the pot'];
  if (item.kind === 'challenge') return [item.handle, ' opened a challenge'];
  if (item.kind === 'live') return [`${item.handle} vs ${item.opponent || 'TBD'}`];
  return [item.handle, ` backed ${item.side}`];
}

export default function FeedItem({ item, index = 0 }) {
  const kind = KINDS[item.kind] || KINDS.challenge;
  const Icon = kind.Icon;
  const [lead, rest] = line(item);
  const when = item.at ? formatDistanceToNowStrict(new Date(item.at), { addSuffix: true }) : '';

  return (
    <Link
      to={item.match_id ? `/match/${item.match_id}` : '/lobby'}
      className="group flex items-start gap-3 px-4 py-3 transition hover:bg-secondary/40"
    >
      <span
        className={`relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[10deg] ${TONES[kind.tone]}`}
      >
        <Icon className="animate-drift h-4 w-4" strokeWidth={2.4} style={{ animationDelay: `${index * 320}ms` }} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-snug text-foreground/90">
          <span className="font-semibold text-foreground">{lead}</span>
          {rest}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">
          {[item.game, when].filter(Boolean).join(' · ')}
        </span>
      </span>

      <span
        className={`nums shrink-0 pt-0.5 text-sm font-semibold ${
          kind.amount === 'primary' ? 'text-primary' : kind.amount === 'live' ? 'text-live' : 'text-win'
        }`}
      >
        {fmtCoin(item.amount, item.coin)}
      </span>
    </Link>
  );
}