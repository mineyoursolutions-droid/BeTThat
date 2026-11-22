// Mobile-first date/time picker: a bottom-sheet picker on small screens,
// a centred dialog on desktop. Replaces native <input type="datetime-local">
// elements, whose OS pickers, tiny tap targets and inconsistent styling
// are flagged by the Google Play scan ("Dropdowns & Selection Controls").
//
// Value format is kept identical to datetime-local so callers and the
// backend need no change: '' (unset) or 'YYYY-MM-DDTHH:mm' in local time.
//
// Usage:
//   <MobileDateTimePicker label="Scheduled start" value={form.starts_at}
//     onChange={(v) => setForm((f) => ({ ...f, starts_at: v }))} />
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

function parseValue(value) {
  if (!value) return { date: undefined, time: '' };
  const [datePart, timePart] = String(value).split('T');
  const [y, mo, d] = (datePart || '').split('-').map(Number);
  if (!y || !mo || !d) return { date: undefined, time: '' };
  return { date: new Date(y, mo - 1, d), time: (timePart || '').slice(0, 5) };
}

function toValue(date, time) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}T${time}`;
}

function formatValue(value) {
  if (!value) return '';
  const { date, time } = parseValue(value);
  if (!date) return '';
  const [h, m] = time.split(':').map(Number);
  const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h || 0, m || 0);
  const day = at.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const clock = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${clock}`;
}

function formatSlot(time) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function MobileDateTimePicker({ value, onChange, label, placeholder = 'Pick a date and time', className = '' }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(undefined);
  const [draftTime, setDraftTime] = useState('');

  const startOfToday = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const openPicker = () => {
    const parsed = parseValue(value);
    setDraftDate(parsed.date);
    setDraftTime(parsed.time);
    setOpen(true);
  };

  const isToday = draftDate && draftDate.toDateString() === new Date().toDateString();
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const commit = () => {
    if (!draftDate) return;
    // No time picked yet: default to early evening rather than midnight.
    onChange(toValue(draftDate, draftTime || '18:00'));
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setOpen(false);
  };

  const body = (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={draftDate}
        onSelect={setDraftDate}
        disabled={{ before: startOfToday }}
        classNames={{}}
        className="mx-auto w-fit"
      />
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Clock className="h-4 w-4" /> Time
        </p>
        <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto pr-1">
          {TIME_SLOTS.map((slot) => {
            const [h, m] = slot.split(':').map(Number);
            const past = isToday && h * 60 + m <= nowMinutes;
            const active = slot === draftTime;
            return (
              <button
                key={slot}
                type="button"
                disabled={past}
                onClick={() => setDraftTime(slot)}
                aria-pressed={active}
                className={cn(
                  'flex min-h-11 items-center justify-center rounded-lg border px-2 py-2 text-sm font-medium transition disabled:opacity-40',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground hover:border-primary/40',
                )}
              >
                {formatSlot(slot)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clear}
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={!draftDate}
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>
  );

  const trigger = (
    <button
      type="button"
      onClick={openPicker}
      aria-label={label}
      aria-haspopup="dialog"
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/50',
        !value && 'text-muted-foreground',
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">
        <CalendarDays className="h-4 w-4 shrink-0 opacity-60" />
        <span className="truncate">{value ? formatValue(value) : placeholder}</span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
    </button>
  );

  if (!isMobile) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{label}</DialogTitle>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerHeader>
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[70vh] overflow-y-auto px-4 pb-2">{body}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
