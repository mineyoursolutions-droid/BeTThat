import { useState } from 'react';
import { Loader2, FileImage, FileVideo } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function ProofChip({ label, uri, kind }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!uri) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10.5px] text-muted-foreground">
        {label || '—'}: no proof
      </span>
    );
  }

  const open = async () => {
    setBusy(true);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
      if (!signed_url) throw new Error('No URL returned.');
      window.open(signed_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast({ title: 'Could not open proof', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-semibold text-foreground transition hover:border-primary/40 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : kind === 'video' ? <FileVideo className="h-3 w-3" /> : <FileImage className="h-3 w-3" />}
      {label || '—'}: view {kind || 'proof'}
    </button>
  );
}