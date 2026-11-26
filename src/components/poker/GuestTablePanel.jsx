// GuestTablePanel — the play-money controls shown on a poker lobby or
// table while the visitor is signed out. Lets a guest pick a display
// name (saved in this browser only) and, on a lobby, open a private
// play-money table. Signed-in players never see this panel.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Lock, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PLAY_BUY_INS, guestDisplayName, guestPayload } from '@/lib/guest';

export default function GuestTablePanel({ gameSlug, gameName, guest, onNameSaved, compact = false }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState(guest.handle || '');
  const [buyIn, setBuyIn] = useState(PLAY_BUY_INS[1]);
  const [creating, setCreating] = useState(false);

  const saveName = () => {
    onNameSaved(name);
    toast({ title: 'Name saved', description: `You will play as ${guestDisplayName({ ...guest, handle: name })}.` });
  };

  const createPrivateTable = async () => {
    setCreating(true);
    try {
      const res = await base44.functions.invoke('createGuestTable', {
        game_slug: gameSlug,
        buy_in: buyIn,
        ...guestPayload(guest),
      });
      const table = res?.data?.table || res?.data;
      if (!table?.id) throw new Error('No table came back — try again.');
      toast({
        title: 'Private table created',
        description: `Join code ${table.join_code} — share the link with your friends.`,
      });
      navigate(`/poker/${gameSlug}/${table.id}?code=${table.join_code}`);
    } catch (err) {
      toast({
        title: 'Could not create the table',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-400/30 bg-cyan-950/30 p-4">
      <div className="flex items-center gap-2">
        <Coins className="h-5 w-5 text-cyan-300" />
        <p className="text-sm font-bold text-cyan-100">Play money — no account, no real stakes</p>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-cyan-100/70">
        Play {gameName} with virtual chips. Nothing here is real money, and no crypto ever moves. Pick a name, then
        open a private table and invite your friends.
      </p>

      <div className="mt-3 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Label htmlFor={`guest-name-${gameSlug}`} className="text-xs text-cyan-100/70">
            Your display name
          </Label>
          <Input
            id={`guest-name-${gameSlug}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder={guestDisplayName(guest)}
            className="mt-1 bg-background/60"
          />
        </div>
        <Button type="button" variant="outline" onClick={saveName} className="shrink-0">
          Save name
        </Button>
      </div>

      {!compact && (
        <>
          <div className="mt-4">
            <Label className="text-xs text-cyan-100/70">Play-chip buy-in</Label>
            <div className="mt-1 flex gap-2">
              {PLAY_BUY_INS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setBuyIn(amount)}
                  className={`flex-1 rounded-xl border px-2 py-2 text-sm font-bold transition ${
                    buyIn === amount
                      ? 'border-cyan-400 bg-cyan-400/20 text-cyan-100'
                      : 'border-border text-muted-foreground hover:border-cyan-400/40'
                  }`}
                >
                  {amount.toLocaleString()} chips
                </button>
              ))}
            </div>
          </div>
          <Button type="button" onClick={createPrivateTable} disabled={creating} className="mt-4 w-full">
            <Lock className="mr-2 h-4 w-4" />
            {creating ? 'Opening your table…' : 'Create a private table'}
          </Button>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-cyan-100/60">
            <Users className="h-3.5 w-3.5" />
            Private tables never show in the public lobby — friends join with your link or code.
          </p>
        </>
      )}
    </div>
  );
}
