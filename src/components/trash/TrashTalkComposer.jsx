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
      <div className="mt-3 rounded-xl border border-dashed border-border px-3.5 py-3 text-sm text-muted-foreground">
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
    const body = text.trim();
    // Optimistic: show the post immediately, swap in the saved one (or
    // remove it) once the backend answers.
    const tempId = `temp-${Date.now()}`;
    const side = match.creator_id === user?.id ? 'creator' : match.challenger_id === user?.id ? 'challenger' : 'spectator';
    const temp = {
      id: tempId,
      match_id: match.id,
      user_id: user?.id,
      user_handle: user?.full_name || (user?.email ? String(user.email).split('@')[0] : 'You'),
      side,
      body,
      created_date: new Date().toISOString(),
      _pending: true,
    };
    onPosted?.(temp, null);
    setText('');
    try {
      const res = await base44.functions.invoke('sendTrashTalk', { match_id: match.id, text: body });
      if (res.data?.post) onPosted?.(res.data.post, tempId);
    } catch (err) {
      onPosted?.(null, tempId);
      setText(body);
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
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary/50"
      />
      <button
        type="button"
        onClick={send}
        disabled={busy || !text.trim()}
        aria-label="Post trash talk"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition disabled:opacity-40 md:h-9 md:w-9"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </div>
  );
}