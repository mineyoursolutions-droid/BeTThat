import { useState } from 'react';
import { Loader2, Radio } from 'lucide-react';
import { COINS, GAMES } from '@/lib/demo';
import ReputationBadge, { RecordLine } from '@/components/ReputationBadge';
import MobileSelect from '@/components/mobile/MobileSelect';

const PLATFORMS = ['Xbox', 'PlayStation', 'PC', 'Switch'];

const empty = (profile) => ({
  xbox_gamertag: profile?.xbox_gamertag || '',
  psn_id: profile?.psn_id || '',
  steam_id: profile?.steam_id || '',
  platform: profile?.platform || 'Xbox',
  game_slug: profile?.game_slug || GAMES[0].slug,
  coin: profile?.coin || 'USDT',
  stake: profile?.stake || '',
  looking_note: profile?.looking_note || '',
});

export default function MyPresence({ profile, onSave, saving }) {
  const [form, setForm] = useState(() => empty(profile));
  const looking = Boolean(profile?.looking);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const submit = (nextLooking) => onSave({ ...form, stake: Number(form.stake || 0), looking: nextLooking });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-primary" />
        <h2 className="text-[14px] font-semibold">Your player card</h2>
        {looking ? (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-win/10 px-2 py-0.5 text-sm font-bold uppercase tracking-[0.1em] text-win">
            Listed
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Add your console ID so an opponent can add you and send the invite. Nothing is shared until you list yourself.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-background/60 px-3.5 py-2.5">
        <ReputationBadge profile={profile} />
        <RecordLine profile={profile} />
        <p className="text-sm text-muted-foreground">
          Built from settled matches and operator disputes — it updates automatically when a match settles.
        </p>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        <Input label="Xbox gamertag" value={form.xbox_gamertag} onChange={set('xbox_gamertag')} placeholder="Gamertag" />
        <Input label="PlayStation ID" value={form.psn_id} onChange={set('psn_id')} placeholder="PSN ID" />
        <Input label="Steam ID" value={form.steam_id} onChange={set('steam_id')} placeholder="Steam" />
      </div>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-4">
        <div><span className="mb-1 block text-sm uppercase tracking-[0.14em] text-muted-foreground">Platform</span><MobileSelect label="Platform" value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })} options={PLATFORMS.map((p) => ({ value: p, label: p }))} /></div>
        <div><span className="mb-1 block text-sm uppercase tracking-[0.14em] text-muted-foreground">Game</span><MobileSelect label="Game" value={form.game_slug} onValueChange={(v) => setForm({ ...form, game_slug: v })} options={GAMES.map((g) => ({ value: g.slug, label: g.name }))} /></div>
        <div><span className="mb-1 block text-sm uppercase tracking-[0.14em] text-muted-foreground">Coin</span><MobileSelect label="Coin" value={form.coin} onValueChange={(v) => setForm({ ...form, coin: v })} options={COINS.map((c) => ({ value: c.ticker, label: c.ticker }))} /></div>
        <Input label="Stake" value={form.stake} onChange={set('stake')} placeholder="50" type="number" />
      </div>

      <div className="mt-2.5">
        <Input label="Rules or note" value={form.looking_note} onChange={set('looking_note')} placeholder="FT3 · ranked rules · no items" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(!looking)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
            looking ? 'border border-border text-muted-foreground hover:text-foreground' : 'bg-primary text-primary-foreground hover:brightness-105'
          }`}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
          {looking ? 'Stop looking' : "I'm looking for a game"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => submit(looking)}
          className="rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          Save details
        </button>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50"
      />
    </label>
  );
}

