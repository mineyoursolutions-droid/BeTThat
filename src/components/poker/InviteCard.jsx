// InviteCard — the shareable invite for a private play-money table:
// the join link plus the 6-character code, with copy buttons.
import { useState } from 'react';
import { Check, Link2, Lock } from 'lucide-react';

export default function InviteCard({ gameSlug, tableId, joinCode, className = '' }) {
  const [copied, setCopied] = useState(null);
  if (!joinCode) return null;
  const url = `${window.location.origin}/poker/${gameSlug}/${tableId}?code=${joinCode}`;

  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      window.prompt('Copy this', value);
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };

  return (
    <div className={`rounded-2xl border border-cyan-400/30 bg-cyan-950/30 p-4 ${className}`}>
      <p className="flex items-center gap-2 text-sm font-bold text-cyan-100">
        <Lock className="h-4 w-4 text-cyan-300" />
        Private table — invite your friends
      </p>
      <p className="mt-1 text-[13px] text-cyan-100/70">
        This table is private. Share the link or the code — anyone with it can sit down with play chips.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => copy(url, 'link')}
          className="inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-cyan-400/40"
        >
          {copied === 'link' ? <Check className="h-4 w-4 shrink-0 text-cyan-300" /> : <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="truncate">{copied === 'link' ? 'Link copied' : url}</span>
        </button>
        <button
          type="button"
          onClick={() => copy(joinCode, 'code')}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-2 text-sm font-bold tracking-[0.2em] text-foreground transition hover:border-cyan-400/40"
        >
          {copied === 'code' ? <Check className="h-4 w-4 text-cyan-300" /> : null}
          {copied === 'code' ? 'Copied' : joinCode}
        </button>
      </div>
    </div>
  );
}
