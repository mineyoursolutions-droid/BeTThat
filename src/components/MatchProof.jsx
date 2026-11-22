import { useState } from 'react';

import { Loader2, Upload, CheckCircle2, FileImage, FileVideo, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const ELIGIBLE = ['matched', 'in_play', 'awaiting_result'];

export default function MatchProof({ match, user, onChanged }) {
  const { toast } = useToast();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  let side;
  if (match.creator_id === user.id) side = 'creator';
  else if (match.challenger_id === user.id) side = 'challenger';
  else return null;

  const myUri = side === 'creator' ? match.creator_proof_uri : match.challenger_proof_uri;
  const myKind = side === 'creator' ? match.creator_proof_kind : match.challenger_proof_kind;
  const myAt = side === 'creator' ? match.creator_proof_at : match.challenger_proof_at;
  const oppUri = side === 'creator' ? match.challenger_proof_uri : match.creator_proof_uri;

  const canUpload = ELIGIBLE.includes(match.status);

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      toast({ title: 'Unsupported file', description: 'Upload a screenshot image or a video clip.', variant: 'destructive' });
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setUploading(false);
      setSubmitting(true);
      const kind = file.type.startsWith('video/') ? 'video' : 'image';
      const res = await base44.functions.invoke('submitProof', {
        match_id: match.id,
        file_uri,
        kind,
        note: '',
      });
      toast({ title: 'Evidence submitted', description: 'The operator can now review your score proof.' });
      setFile(null);
      onChanged?.(res.data.match);
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-primary" />
        <h2 className="text-[14px] font-semibold">Score evidence</h2>
      </div>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
        Upload a screenshot or short clip of the final scoreboard. The operator reviews it if the result is disputed.
      </p>

      {match.result_disputed ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-live/30 bg-live/[0.06] p-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-live" />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            This result is disputed. Add your scoreboard screenshot or clip now — the operator settles the pot from the
            evidence on file.
          </p>
        </div>
      ) : null}

      {myUri ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-win/30 bg-win/[0.05] p-3.5">
          {myKind === 'video' ? <FileVideo className="h-4 w-4 text-win" /> : <FileImage className="h-4 w-4 text-win" />}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-win">
              <CheckCircle2 className="h-3.5 w-3.5" /> Your evidence is on file
            </p>
            {myAt ? <p className="mt-0.5 text-[10.5px] text-muted-foreground">Submitted {new Date(myAt).toLocaleString()}</p> : null}
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-[10.5px] text-muted-foreground">
        {oppUri ? 'Your opponent has also submitted evidence.' : 'Waiting for your opponent to submit evidence.'}
      </p>

      {canUpload ? (
        <div className="mt-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3.5 py-2 text-[12px] font-semibold transition hover:border-primary/40">
            <Upload className="h-3.5 w-3.5" />
            {myUri ? 'Replace evidence' : 'Choose file'}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={pick} />
          </label>
          {file ? <p className="mt-2 text-[11px] text-muted-foreground">{file.name}</p> : null}
          {file ? (
            <button
              type="button"
              onClick={submit}
              disabled={uploading || submitting}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition disabled:opacity-50"
            >
              {uploading || submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading…' : submitting ? 'Submitting…' : 'Submit evidence'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}