import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Loader2, Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { PLATFORMS, gamesFor, handleOf, newRoomCode, platformById } from '@/lib/console';
import MobileSelect from '@/components/mobile/MobileSelect';

const REGIONS = ['Global', 'US East', 'US West', 'EU West', 'EU North', 'Asia Pacific', 'South America', 'Oceania'];

export default function RoomForm({ user, preset, onCreated }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    platform: 'wii',
    game_slug: 'wii-pool',
    title: '',
    region: 'Global',
    lobby_code: '',
    starts_at: '',
    note: '',
  });

  const options = gamesFor(form.platform);
  const game = options.find((g) => g.slug === form.game_slug)?.game;

  useEffect(() => {
    if (!preset) return;
    setForm((f) => ({ ...f, platform: preset.platform, game_slug: preset.slug }));
    setCreated(null);
  }, [preset]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickPlatform = (id) => {
    const list = gamesFor(id);
    setForm((f) => ({
      ...f,
      platform: id,
      game_slug: list.some((g) => g.slug === f.game_slug) ? f.game_slug : list[0]?.slug || f.game_slug,
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const room = await base44.entities.ConsoleRoom.create({
        room_code: newRoomCode(),
        platform: form.platform,
        game_slug: form.game_slug,
        game_name: game?.name || form.game_slug,
        title: form.title || game?.subtitle || '',
        region: form.region,
        lobby_code: form.lobby_code.trim(),
        note: form.note.trim(),
        starts_at: form.starts_at,
        host_id: user.id,
        host_handle: handleOf(user),
        status: 'open',
      });
      setCreated(room);
      onCreated?.(room);
      toast({ title: 'Room opened', description: 'Share the room code and your opponent can take the seat.' });
    } catch (err) {
      toast({
        title: 'Could not open that room',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h2 className="text-[15px] font-semibold">Open a console room</h2>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          Sign in to claim a seat, generate a room code and lock the stake before either player picks up a cue.
        </p>
        <Link
          to="/login"
          className="mt-4 inline-flex rounded-full bg-primary px-4 py-2.5 text-[12.5px] font-semibold text-primary-foreground"
        >
          Sign in to open a room
        </Link>
      </div>
    );
  }

  if (created) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Room is live</p>
        <p className="mt-2 text-[26px] font-extrabold tracking-[-0.02em]">{created.room_code}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {created.game_name} · {platformById(created.platform).label} · {created.region}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-[12px] font-semibold transition hover:border-primary/40"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-win" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy room code'}
          </button>
          <Link
            to="/create"
            className="inline-flex items-center rounded-full bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            Post the wager
          </Link>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="inline-flex items-center rounded-full px-3.5 py-2 text-[12px] font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Open another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form id="open-room" onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-primary" />
        <h2 className="text-[15px] font-semibold">Open a console room</h2>
      </div>

      <Field label="Console">
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickPlatform(p.id)}
              className={`rounded-xl border px-2 py-2 text-[11.5px] font-semibold transition ${
                form.platform === p.id
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.short}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Billiards title">
        <MobileSelect
          label="Billiards title"
          value={form.game_slug}
          onValueChange={(v) => setForm((f) => ({ ...f, game_slug: v }))}
          options={options.map((entry) => ({ value: entry.slug, label: `${entry.game.name} — ${entry.game.subtitle}` }))}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Table / rules">
          <input
            value={form.title}
            onChange={set('title')}
            placeholder="8-ball · race to 3"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
        </Field>
        <Field label="Region">
          <MobileSelect
            label="Region"
            value={form.region}
            onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}
            options={REGIONS.map((r) => ({ value: r, label: r }))}
          />
        </Field>
      </div>

      <Field label="In-game code (private)">
        <input
          value={form.lobby_code}
          onChange={set('lobby_code')}
          placeholder="Lobby code, room id or direct IP"
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Only you and the player who takes the seat can see this.
        </p>
      </Field>

      <Field label="Scheduled break (optional)">
        <input
          type="datetime-local"
          value={form.starts_at}
          onChange={set('starts_at')}
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-primary/50"
        />
      </Field>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-[13.5px] font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
        {busy ? 'Opening room…' : 'Open room'}
      </button>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}