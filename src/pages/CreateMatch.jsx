import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import CoinMark from '@/components/CoinMark';
import MobileSelect from '@/components/mobile/MobileSelect';
import { COINS, GAMES, fmtCoin } from '@/lib/demo';

export default function CreateMatch() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [wallets, setWallets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    game_slug: 'cod',
    title: '',
    ruleset: '',
    platform: 'Cross-play',
    region: 'Global',
    coin: 'USDT',
    stake: '',
    starts_at: '',
  });

  useEffect(() => {
    if (!user) return;
    base44.entities.Wallet.filter({ user_id: user.id }, { limit: 20 }).then((page) => setWallets(page.items || []));
  }, [user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const game = GAMES.find((g) => g.slug === form.game_slug);
  const balance = (wallets.find((w) => w.coin === form.coin) || {}).available || 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await base44.functions.invoke('createMatch', {
        ...form,
        game_name: game ? game.name : form.game_slug,
        stake: Number(form.stake),
      });
      toast({ title: 'Challenge posted', description: 'Your stake is escrowed until someone accepts.' });
      navigate(`/match/${res.data.match.id}`);
    } catch (err) {
      toast({
        title: 'Could not post that challenge',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">New challenge</p>
      <h1 className="mt-2.5 text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[38px]">
        Set your terms
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
        Name the game, the ruleset and the stake. Your stake is held in escrow the moment the challenge goes live.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6">
        <Field label="Game">
          <MobileSelect
            label="Game"
            value={form.game_slug}
            onValueChange={(v) => setForm((f) => ({ ...f, game_slug: v }))}
            options={GAMES.map((g) => ({ value: g.slug, label: `${g.name} — ${g.subtitle}` }))}
          />
        </Field>

        <Field label="Match title">
          <input
            required
            value={form.title}
            onChange={set('title')}
            placeholder="Search & Destroy · Best of 7"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
        </Field>

        <Field label="Ruleset">
          <textarea
            rows={3}
            value={form.ruleset}
            onChange={set('ruleset')}
            placeholder="CDL ruleset, no restricted weapons, host decided by coin flip."
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-[13.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform">
            <MobileSelect
              label="Platform"
              value={form.platform}
              onValueChange={(v) => setForm((f) => ({ ...f, platform: v }))}
              options={['Cross-play', 'PS5', 'Xbox', 'Switch', 'Wii', 'PC'].map((p) => ({ value: p, label: p }))}
            />
          </Field>
          <Field label="Region">
            <MobileSelect
              label="Region"
              value={form.region}
              onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}
              options={['Global', 'US East', 'US West', 'EU West', 'EU North', 'Asia Pacific', 'South America', 'Oceania'].map((r) => ({ value: r, label: r }))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stake coin">
            <div className="grid grid-cols-4 gap-2">
              {COINS.map((c) => (
                <button
                  key={c.ticker}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, coin: c.ticker }))}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition ${
                    form.coin === c.ticker
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CoinMark ticker={c.ticker} size="sm" />
                  {c.ticker}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Stake per player">
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5">
              <CoinMark ticker={form.coin} size="sm" />
              <input
                required
                type="number"
                min="0"
                step="any"
                value={form.stake}
                onChange={set('stake')}
                placeholder="0.00"
                className="nums w-full bg-transparent text-[13.5px] font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[11px] font-semibold text-muted-foreground">{form.coin}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Available {fmtCoin(balance, form.coin)}
            </p>
          </Field>
        </div>

        <Field label="Scheduled start (optional)">
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
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.6} />}
          {busy ? 'Locking stake…' : 'Post challenge'}
        </button>
      </form>
    </div>
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