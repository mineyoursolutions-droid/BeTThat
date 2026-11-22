import { useState } from 'react';
import { Image } from '@/components/ui/image';

export default function QrCode({ value, size = 168 }) {
  const [failed, setFailed] = useState(false);
  if (!value || failed) return null;
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=6&data=${encodeURIComponent(value)}`;

  return (
    <div className="shrink-0 rounded-xl bg-white p-2">
      <Image
        src={src}
        alt="Deposit address QR code"
        className="block"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}