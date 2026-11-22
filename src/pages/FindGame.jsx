import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Swords } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import MyPresence from '@/components/lounge/MyPresence';
import LookingPlayers from '@/components/lounge/LookingPlayers';
import { gameBySlug } from '@/lib/demo';
import MobileBackBar from '@/components/mobile/MobileBackBar';

const ONLINE_WINDOW_MS = 10 * 60 * 1000;

export default function FindGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(undefined);
  const [players, setPlayers] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadPlayers = useCallback(async () => {
    const since = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
    const page = await base44.entities.PlayerProfile.filter(
      { looking: true, last_seen: { $gte: since } },
      { sort: '-last_seen', limit: 60 },
    );
    setPlayers(page.items || []);
  }, []);

  const loadMe = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const page = await base44.entities.PlayerProfile.filter({ user_id: user.id }, { limit: 1 });
    setProfile((page.items || [])[0] || null);
  }, [user]);

  useEffect(() => {
    loadMe();
    loadPlayers();
  }, [loadMe, loadPlayers]);

  // Keep the listing alive while this player stays on the page.
  useEffect(() => {
    if (!user || !profile?.looking) return;
    const id = setInterval(() => {
      base44.functions.invoke('updatePresence', { heartbeat: true }).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, [user, profile]);

  const save = async (values) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('updatePresence', values);
      setProfile(res.data.profile);
      toast({
        title: res.data.profile?.looking ? "You're listed as looking" : 'Player card saved',
        description: res.data.profile?.looking ? 'Other players can now see your stake and console ID.' : undefined,
      });
      loadPlayers();
    } catch (err) {
      toast({ title: 'Could not save', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const challenge = async (player) => {
    setBusyId(player.id);
    try {
      const game = gameBySlug(player.game_slug);
      const res = await base44.functions.invoke('createMatch', {
        title: `${game?.name || 'Match'} · vs ${player.handle}`,
        game_slug: player.game_slug || 'cod',
        coin: player.coin || 'USDT',
        stake: Number(player.stake || 0),
        platform: player.platform || 'Cross-play',
        region: 'Global',
        ruleset: player.looking_note || '',
      });
      const id = res.data.match.id;
      await navigator.clipboard
        .writeText(`${window.location.origin}/match/${id}`)
        .catch(() => {});
      toast({
        title: 'Challenge posted',
        description: 'The invite link is copied — send it to your opponent so they can take the seat.',
      });
      navigate(`/match/${id}`);
    } catch (err) {
      toast({
        title: 'Could not post the challenge',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const others = (players || []).filter((p) => p.user_id !== user?.id);

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <MobileBackBar to="/lobby" label="Lobby" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Matchmaking</p>
          <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[40px]">
            Find a game
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            List yourself with your console ID, or take someone else's stake. Every challenge gets a shareable link you can
            send straight to your opponent.
          </p>
        </div>
        <Link
          to="/lobby"
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-[13px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
        >
          Browse the lobby
        </Link>
      </div>

      <div className="mt-8">
        {!user ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-[14px] font-semibold text-foreground">Sign in to list yourself for a game</p>
            <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
              Anyone can browse who is looking. You need an account to post a stake and share a challenge link.
            </p>
            <Link
              to="/login"
              className="mt-5 inline-flex rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
          </div>
        ) : profile === undefined ? (
          <div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />
        ) : (
          <MyPresence key={profile?.id || 'new'} profile={profile} onSave={save} saving={saving} />
        )}
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-primary" />
          <h2 className="text-[15px] font-semibold">Looking right now</h2>
          {others.length ? (
            <span className="nums rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
              {others.length}
            </span>
          ) : null}
        </div>
        <div className="mt-4">
          <LookingPlayers players={players === null ? null : others} onChallenge={challenge} busyId={busyId} />
        </div>
      </div>
    </div>
  );
}