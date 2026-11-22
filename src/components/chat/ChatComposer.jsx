import { useState } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function ChatComposer({ match, user, onSent }) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      toast({ title: 'Unsupported file', description: 'Attach a screenshot or a video clip.', variant: 'destructive' });
      return;
    }
    setFile(f);
  };

  const send = async () => {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true);
    const body = text.trim();
    // Optimistic: show the message immediately, then swap in the saved one
    // (or remove it) once the backend answers.
    const tempId = `temp-${Date.now()}`;
    const temp = {
      id: tempId,
      match_id: match.id,
      sender_id: user?.id,
      sender_handle: user?.full_name || (user?.email ? String(user.email).split('@')[0] : 'You'),
      side: match.creator_id === user?.id ? 'creator' : 'challenger',
      body,
      file_uri: '',
      file_kind: '',
      created_date: new Date().toISOString(),
      _pending: true,
    };
    if (body) onSent?.(temp, null);
    setText('');
    setFile(null);
    try {
      let file_uri = '';
      let file_kind = '';
      if (file) {
        const uploaded = await base44.integrations.Core.UploadPrivateFile({ file });
        file_uri = uploaded.file_uri;
        file_kind = file.type.startsWith('video/') ? 'video' : 'image';
      }
      const res = await base44.functions.invoke('sendMatchMessage', {
        match_id: match.id,
        text: body,
        file_uri,
        file_kind,
      });
      if (res.data?.message) onSent?.(res.data.message, tempId);
    } catch (err) {
      // Roll back the optimistic message.
      onSent?.(null, tempId);
      setText(body);
      toast({ title: 'Message not sent', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border p-3">
      {file ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
          <span className="truncate text-[11px] text-muted-foreground">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment" className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-1.5">
        <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition hover:border-primary/40 hover:text-primary">
          <Paperclip className="h-4 w-4" />
          <input type="file" accept="image/*,video/*" className="hidden" onChange={pick} />
        </label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Send a message…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[12.5px] outline-none transition focus:border-primary/50"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || (!text.trim() && !file)}
          aria-label="Send message"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}