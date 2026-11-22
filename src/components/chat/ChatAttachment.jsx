import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';

export default function ChatAttachment({ uri, kind }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri })
      .then((res) => {
        if (active) setUrl(res.signed_url || '');
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [uri]);

  if (failed) return <p className="text-sm italic text-muted-foreground">Attachment unavailable</p>;

  if (!url) return <div className="h-24 w-40 animate-pulse rounded-lg bg-secondary" />;

  if (kind === 'video') {
    return <video src={url} controls className="max-h-44 w-full rounded-lg border border-border" />;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <Image src={url} alt="Shared screenshot" className="h-32 w-full rounded-lg" fittingType="fill" />
    </a>
  );
}