import { useCallback, useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { PLATFORMS } from '@/lib/console';
import RoomCard from '@/components/console/RoomCard';

export default function RoomBoard({ user, signal }) {
  const { toast } = useToast();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const page = await base44.entities.ConsoleRoom.filter(
      { status: { $in: ['open', 'matched'] } },
      { sort: '-created_date', limit: 30 },
    );
    setRooms(page.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const unsubscribe = base44.entities.ConsoleRoom.subscribe(() => load());
    return unsubscribe;
  }, [load]);

  useEffect(() => {
    if (signal) load();
  }, [signal, load]);

  const join = async (room) => {
    setBusyId(room.id);
    try {
      const res = await base44.functions.invoke('joinConsoleRoom', { room_id: room.id });
      setRooms((list) => list.map((r) => (r.id === res.data.room.id ? res.data.room : r)));
      toast({ title: 'Seat taken', description: 'The in-game code is unlocked for you.' });
    } catch (err) {
      toast({
        title: 'Could not take that seat',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const close = async (room) => {
    try {
      await base44.entities.ConsoleRoom.update(room.id, { status: 'closed' });
      setRooms((list) => list.filter((r) => r.id !== room.id));
      toast({ title: 'Room closed' });
    } catch (err) {
      toast({ title: 'Could not close the room', description: err.message, variant: 'destructive' });
    }
  };

  const visible = rooms.filter((r) => (filter === 'all' ? true : r.platform === filter));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All consoles
        </Chip>
        {PLATFORMS.map((p) => (
          <Chip key={p.id} active={filter === p.id} onClick={() => setFilter(p.id)}>
            {p.short}
          </Chip>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        ) : visible.length ? (
          visible.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              user={user}
              busy={busyId === room.id}
              onJoin={join}
              onClose={close}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
            <Radio className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">No rooms on this console yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Open one and your opponent can take the seat in seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
        active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}