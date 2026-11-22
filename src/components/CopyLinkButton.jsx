import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';

export default function CopyLinkButton({ matchId, label = 'Copy invite link' }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/match/${matchId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      window.prompt('Copy this challenge link', url);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
    >
      {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </button>
  );
}