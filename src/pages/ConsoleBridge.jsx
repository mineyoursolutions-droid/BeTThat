import { useState } from 'react';
import { Gamepad2, Info } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import RoomForm from '@/components/console/RoomForm';
import RoomBoard from '@/components/console/RoomBoard';
import BilliardsBook from '@/components/console/BilliardsBook';
import PlatformNotes from '@/components/console/PlatformNotes';

export default function ConsoleBridge() {
  const { user } = useAuth();
  const [preset, setPreset] = useState(null);
  const [signal, setSignal] = useState(0);

  const pick = (value) => {
    setPreset(value);
    document.getElementById('open-room')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Console bridge</p>
      <h1 className="mt-2.5 max-w-2xl text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[40px]">
        Both cues, one room
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        A room pairs the two consoles, records the stake and holds the private in-game code until your opponent takes
        the seat. Works for a Wii on the living-room TV, a PS5 in another city and a Steam table across an ocean.
      </p>

      <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Nintendo's Wii online services were retired in 2014 and Wii Play Pool never had an online mode, so no Wii can
          sign in here. A Wii room is a couch session: two players on one console, a photo of the scoreboard for proof,
          and the pot settled through the match page like any other result.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div className="lg:sticky lg:top-20">
          <RoomForm user={user} preset={preset} onCreated={() => setSignal((n) => n + 1)} />
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <h2 className="text-[15px] font-semibold">Rooms waiting for an opponent</h2>
          </div>
          <RoomBoard user={user} signal={signal} />
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">Billiards we can bridge</h2>
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
          Each title exposes a different way in — a private lobby, a friend invite, a room code or a direct address.
          Pick one and the room form is filled in for you. Confirm the title still supports private play on both
          consoles before you stake.
        </p>
        <div className="mt-4">
          <BilliardsBook onPick={pick} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em]">How each console connects</h2>
        <div className="mt-4">
          <PlatformNotes />
        </div>
      </section>

      <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground/80">
        BetThat is not affiliated with Nintendo, Sony, Microsoft or any game publisher. Rooms are a coordination tool:
        the console connection happens inside the game you own.
      </p>
    </div>
  );
}