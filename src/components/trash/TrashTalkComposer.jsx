import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function TrashTalkComposer({ match, user, onPosted }) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border px-3.5 py-3 text-[11.5px] text-muted-foreground">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>{' '}
        to talk trash with the players.
      </div>
    );
  }

  const send = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('sendTrashTalk', { match_id: match.id, text: text.trim() });
      if (res.data?.post) onPosted?.(res.data.post);
      setText('');
    } catch (err) {
      toast({ title: 'Could not post', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-1.5">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            send();
          }
        }}
        maxLength={400}
        placeholder="Talk your talk…"
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] outline-none transition focus:border-primary/50"
      />
      <button
        type="button"
        onClick={send}
        disabled={busy || !text.trim()}
        aria-label="Post trash talk"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </div>
  );
}