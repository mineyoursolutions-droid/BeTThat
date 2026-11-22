// Mobile-first select: a bottom-sheet picker on small screens, the existing
// Radix Select on desktop. Replaces native HTML <select> elements, whose
// OS dropdowns, tiny tap targets and inconsistent styling are flagged by the
// Google Play scan ("Dropdowns & Selection Controls").
//
// Usage:
//   <MobileSelect value={v} onValueChange={setV} label="Game"
//     options={[{ value: 'cod', label: 'Call of Duty' }]} />
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

export default function MobileSelect({ value, onValueChange, options, label, placeholder = '', className = '' }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.value) === String(value));

  if (!isMobile) {
    return (
      <Select value={String(value)} onValueChange={onValueChange}>
        <SelectTrigger className={cn('min-h-11', className)} aria-label={label}>
          <SelectValue placeholder={placeholder || label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={String(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-haspopup="dialog"
        className={cn(
          'flex min-h-11 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2.5 text-[13.5px] text-foreground outline-none transition focus:border-primary/50',
          className,
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder || label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <DrawerHeader>
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-4 pb-2">
            {options.map((o) => {
              const active = String(o.value) === String(value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onValueChange(String(o.value));
                    setOpen(false);
                  }}
                  aria-pressed={active}
                  className={cn(
                    'flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-[14px] font-medium transition',
                    active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary',
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
