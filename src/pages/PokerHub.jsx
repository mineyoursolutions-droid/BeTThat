import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound, Spade } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useGuest, guestPayload } from '@/lib/guest';
import chainGangIcon from '@/assets/chain-gang-poker-icon.svg';
import GuestTablePanel from '@/components/poker/GuestTablePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

// Chain Gang Poker hub — the one place for all six house poker games.
// Each game has its own lobby; picking one opens a live table where the
// system shuffles and deals the cards (server-side, no dealer to trust).
//
// Two ways to play: signed in, with real-money tables (BTC, ETH, USDT,
// USDC, 5% house fee at showdown), or as a guest, with virtual play
// chips on private tables — no account needed.
const GAMES = [
  {
    name: 'Bone Crusher',
    aka: 'Kick Two Roll One',
    to: '/poker/bone-crusher',
    players: 'Up to 5 players',
    cards: '7 cards each',
    blurb:
      'Four cards turned face up one at a time with a bet on each. Declare high, low, or swing — best five-card hand wins, pot splits high / low.',
  },
  {
    name: 'Tic Tac Toe',
    aka: '3 × 3 grid',
    to: '/poker/tic-tac-toe',
    players: 'Up to 5 players',
    cards: '9 cards each',
    blurb:
      'Nine cards in a 3 × 3 grid. Best 3-card hand from any row, column, or diagonal — played high or low.',
  },
  {
    name: 'Straight High',
    aka: 'High Paduki',
    to: '/poker/straight-high',
    players: 'Up to 5 players',
    cards: '4 cards each',
    blurb:
      'Four-card draw, best high hand takes the whole pot. K-Q-J-T is the wheel — three draws, a bet on each draw.',
  },
  {
    name: 'Lowball',
    aka: 'Ace-to-five',
    to: '/poker/lowball',
    players: 'Up to 5 players',
    cards: '5 cards each',
    blurb:
      'Lowest hand wins — A-2-3-4-5 is the nuts. Pairs count against you, straights and flushes do not. Pot splits.',
  },
  {
    name: 'Paduki',
    aka: 'One of each suit',
    to: '/poker/paduki',
    players: 'Up to 5 players',
    cards: '4 cards each',
    blurb:
      'A made hand needs one of each suit. High wheel K-Q-J-T, low wheel A-2-3-4. Three draws — throw back 3, then 2, then 1.',
  },
  {
    name: 'Dead Seven',
    aka: 'A 7 kills it',
    to: '/poker/dead-seven',
    players: 'Up to 5 players',
    cards: '5 cards each',
    blurb:
      'Five cards, one betting round, then showdown. A 7 in your hand kills it — A–6 play low, 8 and up play high.',
  },
];

export default function PokerHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { guest, saveName } = useGuest();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const joinWithCode = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      toast({ title: 'That code is 6 characters', description: 'Check the invite and try again.', variant: 'destructive' });
      return;
    }
    setJoining(true);
    try {
      const res = await base44.functions.invoke('joinGuestTable', {
        join_code: clean,
        ...(user ? {} : guestPayload(guest)),
      });
      const table = res?.data?.table || res?.data;
      if (!table?.id || !table?.game_slug) throw new Error('No table came back — check the code and try again.');
      navigate(`/poker/${table.game_slug}/${table.id}?code=${clean}`);
    } catch (err) {
      toast({
        title: 'Could not join that table',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <img
            src={chainGangIcon}
            alt="Chain Gang Poker — neon barbed wire with a prison guard tower"
            className="h-16 w-16 shrink-0 rounded-2xl sm:h-20 sm:w-20"
          />
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Live poker</p>
            <h1 className="mt-1 font-graffiti text-4xl leading-none text-foreground sm:text-5xl">
              <span className="neon-sign-cyan">Chain Gang</span>{' '}
              <span className="neon-sign-lime">Poker</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Pick a game, open a table or take a seat, and the system deals the cards live — shuffled server-side,
              no dealer, no deck to trust. Sign in to play real-money tables with BTC, ETH, USDT, or USDC (5% house
              fee at showdown), or play as a guest with virtual chips on a private table — no account needed.
            </p>
          </div>
        </div>
        <Link
          to="/lobby"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:border-primary/40 hover:text-primary"
        >
          Back to the lobby
        </Link>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {!user && (
          <GuestTablePanel gameSlug="bone-crusher" gameName="Chain Gang Poker" guest={guest} onNameSaved={saveName} compact />
        )}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <KeyRound className="h-4 w-4 text-primary" />
            Join with code
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Got an invite to a friend&apos;s private table? Enter the 6-character code — no account needed for a
            play-money table.
          </p>
          <div className="mt-3 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Label htmlFor="join-code" className="text-xs text-muted-foreground">
                Invite code
              </Label>
              <Input
                id="join-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
                className="mt-1 font-mono text-lg font-bold tracking-[0.3em] uppercase"
              />
            </div>
            <Button type="button" onClick={joinWithCode} disabled={joining || code.trim().length !== 6}>
              {joining ? 'Joining…' : 'Join table'}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAMES.map((game) => (
          <div
            key={game.to}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-graffiti text-[26px] leading-none text-foreground">{game.name}</h2>
                  <p className="mt-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">{game.aka}</p>
                </div>
                <Spade className="h-5 w-5 shrink-0 text-primary/70" />
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{game.blurb}</p>
              <p className="nums mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {game.players} · {game.cards}
              </p>
              <Link
                to={game.to}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
              >
                Play live
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
