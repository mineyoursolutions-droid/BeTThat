// Delete Account — required by Google Play when an app requires login.
//
// Opens a confirmation dialog that explains exactly what is permanently
// removed, requires typing DELETE to confirm, then calls the backend
// deleteAccount function and signs the user out. If the backend refuses
// (open wagers, locked escrow funds, unsettled matches), the reason is shown
// and nothing is deleted.
import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function DeleteAccount({ className }) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const confirmed = confirm.trim().toUpperCase() === 'DELETE';

  const runDelete = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('deleteAccount', {});
      const deleted = res?.data?.deleted || {};
      const counts = Object.entries(deleted)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ');
      toast({
        title: 'Account deleted',
        description: counts
          ? `Your profile, wagers, messages and related records were permanently removed (${counts}).`
          : 'Your profile and related records were permanently removed.',
      });
      setOpen(false);
      logout(false);
    } catch (err) {
      toast({
        title: 'Account could not be deleted',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setConfirm(''); }}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label="Delete my account"
          className={
            className ||
            'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-1.5 text-[12px] font-semibold text-destructive transition hover:bg-destructive/10'
          }
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Delete account</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes your profile, player card, wallets, wagers, matches you created,
            pitches, contracts, messages and trash talk. Settled matches involving other players are
            kept only as anonymised records (shown as &ldquo;Deleted player&rdquo;), so their results
            stay verifiable. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            If you still have open wagers, locked escrow funds or an unsettled match, deletion is
            blocked until those are settled or withdrawn — the app will tell you what is still open.
            Your platform sign-in itself is removed by signing out here; to erase the underlying
            Base44 identity, contact support after this step.
          </p>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Type DELETE to confirm
          </label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[13.5px] font-semibold tracking-widest text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-destructive/60"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep my account</AlertDialogCancel>
          <AlertDialogAction
            disabled={!confirmed || busy}
            onClick={(e) => {
              e.preventDefault();
              runDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy ? 'Deleting…' : 'Delete my account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
