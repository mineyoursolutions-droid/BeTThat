import { useEffect, useMemo, useRef, useState } from 'react';
import { Wallet } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import DepositQuoteForm from './DepositQuoteForm';
import DepositInstructions from './DepositInstructions';
import ManualDeposit from './ManualDeposit';
import { networkById, pairKey } from '@/lib/crypto';

const TERMINAL = ['confirmed', 'expired'];

export default function DepositCard({ addresses = [], preferredCoin, onSubmitted }) {
  const { toast } = useToast();
  const [pair, setPair] = useState(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState(null);
  const [payment, setPayment] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const settled = useRef(false);

  const pairs = useMemo(
    () =>
      (addresses || []).filter((row) => {
        const network = networkById(row.network);
        return Boolean(row.address && network && network.coins.includes(row.coin));
      }),
    [addresses],
  );

  useEffect(() => {
    if (!pairs.length) {
      setPair(null);
      return;
    }
    const stillThere = pair && pairs.some((row) => pairKey(row.coin, row.network) === pairKey(pair.coin, pair.network));
    if (stillThere) return;
    const preferred = pairs.find((row) => row.coin === preferredCoin) || pairs[0];
    setPair({ coin: preferred.coin, network: preferred.network });
  }, [pairs, preferredCoin, pair]);

  useEffect(() => {
    if (!quote || settled.current) return;
    let stopped = false;

    const tick = async () => {
      if (stopped || settled.current) return;
      try {
        const res = await base44.functions.invoke('cryptoPay', { action: 'verify', payment_id: quote.payment_id });
        if (stopped) return;
        const next = res.data.payment;
        setPayment(next);
        setMessage(next.status === 'failed' ? res.data.message || '' : '');
        if (TERMINAL.includes(next.status)) {
          settled.current = true;
          if (next.status === 'confirmed') {
            toast({ title: 'Deposit confirmed', description: `${next.amount} ${next.coin} added to your balance.` });
            onSubmitted();
          }
        }
      } catch (err) {
        // a failed poll retries on the next tick
      }
    };

    const id = setInterval(tick, 10000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [quote, onSubmitted, toast]);

  const createQuote = async () => {
    if (!pair) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await base44.functions.invoke('cryptoPay', {
        action: 'quote',
        coin: pair.coin,
        network: pair.network,
        amount: Number(amount),
      });
      settled.current = false;
      setQuote(res.data);
      setPayment({ ...res.data, status: 'awaiting_tx', tx_hash: '', credited: false });
      setAmount(String(res.data.amount));
    } catch (err) {
      toast({
        title: 'Could not create that payment',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const submitHash = async (hash) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('cryptoPay', {
        action: 'submit',
        payment_id: quote.payment_id,
        tx_hash: hash,
      });
      const next = res.data.payment;
      setPayment(next);
      setMessage(res.data.message || '');
      if (next.status === 'confirmed') {
        settled.current = true;
        toast({ title: 'Deposit confirmed', description: `${next.amount} ${next.coin} added to your balance.` });
        onSubmitted();
      } else if (next.status === 'verifying') {
        toast({ title: 'Transaction found', description: 'Watching the chain for confirmations.' });
      }
    } catch (err) {
      toast({
        title: 'Could not check that transfer',
        description: err?.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    settled.current = true;
    setQuote(null);
    setPayment(null);
    setMessage('');
    setAmount('');
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-[14px] font-semibold">
        <Wallet className="h-3.5 w-3.5 text-primary" />
        Fund your balance
      </h3>

      {!pairs.length ? (
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          No deposit address is active yet. Payments cannot be created until an operator publishes a coin and network in
          crypto settings.
        </p>
      ) : quote ? (
        <div className="mt-4">
          <DepositInstructions
            quote={quote}
            payment={payment}
            busy={busy}
            message={message}
            onSubmit={submitHash}
            onReset={reset}
          />
        </div>
      ) : (
        <div className="mt-4">
          <DepositQuoteForm
            pairs={pairs}
            pair={pair}
            onPair={setPair}
            amount={amount}
            onAmount={setAmount}
            onSubmit={createQuote}
            busy={busy}
          />
          <ManualDeposit coin={pair ? pair.coin : 'USDT'} onSubmitted={onSubmitted} />
        </div>
      )}
    </div>
  );
}