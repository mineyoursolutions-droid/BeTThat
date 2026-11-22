import { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import CoinMark from '@/components/CoinMark';
import QrCode from './QrCode';
import { fmtCoin, fmtUsd } from '@/lib/demo';
import { explorerUrl, networkById } from '@/lib/crypto';

const TONE = {
  awaiting_tx: 'text-primary',
  verifying: 'text-primary',
  confirmed: 'text-win',
  expired: 'text-live',
  failed: 'text-live',
};

const LABEL = {
  awaiting_tx: 'Waiting for your transfer',
  verifying: 'Checking the chain',
  confirmed: 'Confirmed and credited',
  expired: 'Quote expired',
  failed: 'Transfer did not match',
};

export default function DepositInstructions({ quote, payment, busy, onSubmit, onReset, message }) {
  const [hash, setHash] = useState('');
  const [copied, setCopied] = useState(false);

  const status = payment?.status || 'awaiting_tx';
  const confirmations = Number(payment?.confirmations || 0);
  const required = Number(payment?.required_confirmations || quote.required_confirmations || 6);
  const sentHash = payment?.tx_hash || '';
  const network = networkById(quote.network);
  const canSubmit = status === 'awaiting_tx' || status === 'failed';
  const pct = required > 0 ? Math.min(100, Math.round((confirmations / required) * 100)) : 0;

  const copy = async () => {
    await navigator.clipboard.writeText(quote.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CoinMark ticker={quote.coin} size="sm" />
          <div>
            <p className="nums text-[13px] font-semibold text-foreground">{fmtCoin(quote.amount, quote.coin)}</p>
            <p className="text-[10.5px] text-muted-foreground">
              {network ? network.label : quote.network} · {quote.amount_usd ? `≈ ${fmtUsd(quote.amount_usd)}` : ''}
            </p>
          </div>
        </div>
        <span className={`text-[10.5px] font-semibold uppercase tracking-[0.12em] ${TONE[status] || 'text-muted-foreground'}`}>
          {LABEL[status] || status}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <QrCode value={quote.address} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={copy}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition hover:border-primary/40"
          >
            <span className="truncate font-mono text-[11px] text-foreground/90">{quote.address}</span>
            {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-win" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </button>
          <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
            Send exactly this amount on {network ? network.label : quote.network}. Other coins or networks are not
            credited.
            {quote.expires_at ? ` Quote expires ${new Date(quote.expires_at).toLocaleTimeString()}.` : ''}
          </p>
        </div>
      </div>

      {status === 'verifying' || status === 'confirmed' ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              {status === 'confirmed' ? null : <Loader2 className="h-3 w-3 animate-spin" />}
              waiting for confirmations ({Math.min(confirmations, required)}/{required})
            </span>
            {sentHash ? (
              <a
                href={explorerUrl(quote.network, sentHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary"
              >
                Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className={`h-full ${status === 'confirmed' ? 'bg-win' : 'bg-primary'}`} style={{ width: `${status === 'confirmed' ? 100 : pct}%` }} />
          </div>
        </div>
      ) : null}

      {canSubmit ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(hash);
          }}
          className="mt-4 space-y-2"
        >
          <label className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Transaction hash</label>
          <input
            required
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            placeholder={quote.network === 'solana' ? 'Solana signature' : quote.network === 'bitcoin' ? 'Bitcoin txid' : '0x…'}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-[11px] outline-none placeholder:text-muted-foreground/60 focus:border-primary/50"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/[0.08] px-4 py-2.5 text-[12.5px] font-semibold text-primary transition hover:bg-primary/[0.14] disabled:opacity-50"
          >
            {busy ? 'Checking the chain…' : 'I sent it — verify now'}
          </button>
        </form>
      ) : null}

      {message ? <p className="mt-2 text-[10.5px] text-live">{message}</p> : null}

      {status === 'confirmed' ? (
        <p className="mt-3 rounded-xl border border-win/25 bg-win/[0.07] px-3 py-2 text-[11px] font-semibold text-win">
          Credited to your balance. The ledger entry is already posted.
        </p>
      ) : null}

      {status === 'expired' ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Nothing was credited. Start a new request once you are ready to send.
        </p>
      ) : null}

      <button
        type="button"
        onClick={onReset}
        className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
      >
        <RotateCcw className="h-3 w-3" />
        New payment request
      </button>
    </div>
  );
}