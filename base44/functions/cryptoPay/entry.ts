import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { COINS, round, handleFor, requireUser, moveFunds, recordLedger } from '../../shared/wallet.ts';

const QUOTE_TTL_MS = 30 * 60 * 1000;
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,usd-coin,tether&vs_currencies=usd';

const PRICE_IDS = { BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin' };

const EVM_CHAINS = {
  ethereum: {
    rpcs: ['https://eth.llamarpc.com', 'https://ethereum-rpc.publicnode.com'],
    confirmations: 6,
    tokens: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
  },
  base: {
    rpcs: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
    confirmations: 6,
    tokens: { USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  },
  polygon: {
    rpcs: ['https://polygon-rpc.com', 'https://polygon-bor-rpc.publicnode.com'],
    confirmations: 6,
    tokens: {
      USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    },
  },
};

const COIN_NETWORKS = {
  BTC: ['bitcoin'],
  ETH: ['ethereum'],
  USDC: ['ethereum', 'base', 'polygon', 'solana'],
  USDT: ['ethereum', 'polygon', 'solana'],
};

function requiredFor(network) {
  if (network === 'bitcoin') return 2;
  if (network === 'solana') return 1;
  const chain = EVM_CHAINS[network];
  return chain ? chain.confirmations : 6;
}

async function asRows(promise) {
  const res = await promise;
  if (Array.isArray(res)) return res;
  return (res && res.items) || [];
}

async function fetchPrice(coin) {
  try {
    const res = await fetch(PRICE_URL, {
      headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; BetThat/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const prices = await res.json().catch(() => ({}));
      const usd = Number((prices[PRICE_IDS[coin]] || {}).usd || 0);
      if (usd > 0) return usd;
    }
  } catch (err) {
    // fall through to the secondary feed
  }

  try {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 0;
    const json = await res.json().catch(() => ({}));
    return Number((json.data || {}).amount || 0);
  } catch (err) {
    return 0;
  }
}

async function rpc(urls, method, params) {
  const endpoints = Array.isArray(urls) ? urls : [urls];
  let lastError = `${method} failed on every node`;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(12000),
      });
      const json = await res.json().catch(() => null);
      if (!json) {
        lastError = `${method} failed on ${url}`;
        continue;
      }
      if (json.error) {
        lastError = json.error.message || `${method} failed on ${url}`;
        continue;
      }
      if (json.result === undefined) {
        lastError = `${method} returned no result on ${url}`;
        continue;
      }
      return json.result;
    } catch (err) {
      lastError = err.message;
    }
  }

  throw new Error(lastError);
}

function evmError(message, required, found) {
  return { found, confirmations: 0, required, amount: 0, error: message };
}

async function checkEvm(payment) {
  const chain = EVM_CHAINS[payment.network];
  const required = chain.confirmations;
  const hash = String(payment.tx_hash || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return evmError('That is not a valid transaction hash for this network.', required, false);

  const target = String(payment.deposit_address || payment.address || '').toLowerCase();
  if (!target) return evmError('This payment has no deposit address on file.', required, false);

  const receipt = await rpc(chain.rpcs, 'eth_getTransactionReceipt', [hash]);
  if (!receipt) return { found: false, confirmations: 0, required, amount: 0 };
  if (receipt.status !== '0x1') return evmError('That transaction failed on chain.', required, true);

  const tokenAddress = chain.tokens[payment.coin];
  let amount = 0;

  if (tokenAddress) {
    const contract = tokenAddress.toLowerCase();
    const paddedTarget = `0x${target.replace(/^0x/, '').padStart(64, '0')}`;
    const log = (receipt.logs || []).find(
      (entry) =>
        String(entry.address || '').toLowerCase() === contract &&
        String((entry.topics || [])[0] || '').toLowerCase() === TRANSFER_TOPIC &&
        String((entry.topics || [])[2] || '').toLowerCase() === paddedTarget,
    );
    if (!log) return evmError('No matching token transfer to your deposit address in that transaction.', required, true);
    amount = Number(BigInt(log.data)) / 1e6;
    if (amount + 1e-9 < Number(payment.amount)) {
      return { ...evmError('The amount transferred is below the quoted amount.', required, true), amount };
    }
  } else {
    const tx = await rpc(chain.rpcs, 'eth_getTransactionByHash', [hash]);
    if (!tx || String(tx.to || '').toLowerCase() !== target) {
      return evmError('That transaction was not sent to your deposit address.', required, true);
    }
    amount = Number(BigInt(tx.value || '0x0')) / 1e18;
    if (amount + 1e-9 < Number(payment.amount)) {
      return { ...evmError('The amount transferred is below the quoted amount.', required, true), amount };
    }
  }

  const head = Number(BigInt(await rpc(chain.rpcs, 'eth_blockNumber', [])));
  const mined = Number(BigInt(receipt.blockNumber));
  return { found: true, confirmations: Math.max(0, head - mined), required, amount };
}

async function checkBitcoin(payment) {
  const required = 2;
  const hash = String(payment.tx_hash || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return evmError('That is not a valid Bitcoin transaction id.', required, false);
  const target = String(payment.deposit_address || payment.address || '').trim();

  const res = await fetch(`https://blockstream.info/api/tx/${hash}`, { signal: AbortSignal.timeout(12000) });
  if (res.status === 404) return { found: false, confirmations: 0, required, amount: 0 };
  if (!res.ok) throw new Error('Blockstream is not answering right now.');
  const tx = await res.json();

  const sats = (tx.vout || [])
    .filter((out) => String(out.scriptpubkey_address || '') === target)
    .reduce((sum, out) => sum + Number(out.value || 0), 0);
  const amount = sats / 1e8;
  if (sats === 0) return evmError('No output in that transaction pays your deposit address.', required, true);
  if (amount + 1e-9 < Number(payment.amount)) {
    return { ...evmError('The amount sent is below the quoted amount.', required, true), amount };
  }

  let confirmations = 0;
  if (tx.status && tx.status.confirmed && tx.status.block_height) {
    const tipRes = await fetch('https://blockstream.info/api/blocks/tip/height', { signal: AbortSignal.timeout(12000) });
    if (!tipRes.ok) throw new Error('Could not read the Bitcoin tip height.');
    const tip = Number((await tipRes.text()).trim());
    confirmations = Math.max(0, tip - Number(tx.status.block_height) + 1);
  }
  return { found: true, confirmations, required, amount };
}

async function checkSolana(payment) {
  const required = 1;
  const hash = String(payment.tx_hash || '').trim();
  if (!hash) return evmError('Paste the transaction signature.', required, false);

  const res = await fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [hash, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
    }),
    signal: AbortSignal.timeout(12000),
  });
  const json = await res.json().catch(() => null);
  if (!json || json.error) throw new Error('Solana RPC is not answering right now.');
  const result = json.result;
  if (!result) return { found: false, confirmations: 0, required, amount: 0 };

  const target = String(payment.deposit_address || payment.address || '').trim();
  const keys = ((result.transaction && result.transaction.message && result.transaction.message.accountKeys) || []).map(
    (key) => (typeof key === 'string' ? key : key.pubkey),
  );
  const index = keys.indexOf(target);
  if (index < 0) return evmError('That transaction does not involve your deposit address.', required, true);

  const pre = Number(((result.meta && result.meta.preBalances) || [])[index] || 0);
  const post = Number(((result.meta && result.meta.postBalances) || [])[index] || 0);
  const amount = (post - pre) / 1e9;
  if (result.meta && result.meta.err) return { ...evmError('That Solana transaction failed on chain.', required, true), amount };
  if (amount + 1e-9 < Number(payment.amount)) {
    return { ...evmError('The amount transferred is below the quoted amount.', required, true), amount };
  }
  return { found: true, confirmations: 1, required, amount };
}

async function checkChain(payment) {
  const network = String(payment.network || '').toLowerCase();
  try {
    if (network === 'bitcoin') return await checkBitcoin(payment);
    if (network === 'solana') return await checkSolana(payment);
    if (EVM_CHAINS[network]) return await checkEvm(payment);
    return evmError('This payment is on a network we cannot verify.', requiredFor(network), false);
  } catch (err) {
    return { found: false, confirmations: 0, required: requiredFor(network), amount: 0, error: err.message };
  }
}

function snapshot(payment) {
  return {
    payment_id: payment.id,
    coin: payment.coin,
    network: payment.network || '',
    address: payment.deposit_address || payment.address || '',
    amount: Number(payment.amount) || 0,
    amount_usd: Number(payment.amount_usd) || 0,
    status: payment.status,
    tx_hash: payment.tx_hash || '',
    confirmations: Number(payment.confirmations) || 0,
    required_confirmations: Number(payment.required_confirmations) || requiredFor(payment.network),
    credited: Boolean(payment.credited),
    expires_at: payment.quote_expires_at || '',
    verified_at: payment.verified_at || '',
  };
}

function canAccess(payment, user) {
  return payment.user_id === user.id || user.role === 'admin';
}

async function loadPayment(base44, id) {
  if (!id) return null;
  return base44.asServiceRole.entities.CryptoTransaction.get(id).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
}

async function creditOnce(base44, payment) {
  const ledgerRows = await asRows(
    base44.asServiceRole.entities.LedgerEntry.filter({ ref_id: payment.id, kind: 'deposit' }),
  );
  const fresh = await loadPayment(base44, payment.id);
  if (!fresh) return payment;
  if (fresh.credited || ledgerRows.length) {
    if (fresh.credited) return fresh;
    return base44.asServiceRole.entities.CryptoTransaction.update(fresh.id, {
      credited: true,
      verified_at: new Date().toISOString(),
    });
  }

  const amount = round(Number(fresh.amount), fresh.coin);
  const wallet = await moveFunds(base44, fresh.user_id, fresh.coin, { available: amount });
  await recordLedger(base44, {
    userId: fresh.user_id,
    coin: fresh.coin,
    amount,
    kind: 'deposit',
    description: 'crypto deposit',
    balanceAfter: wallet.available,
    refId: fresh.id,
  });
  return base44.asServiceRole.entities.CryptoTransaction.update(fresh.id, {
    credited: true,
    verified_at: new Date().toISOString(),
    status: 'confirmed',
  });
}

async function runVerify(base44, payment) {
  if (payment.credited) return { payment, message: '' };

  if (!payment.tx_hash) {
    if (payment.quote_expires_at && new Date(payment.quote_expires_at).getTime() < Date.now()) {
      const expired = await base44.asServiceRole.entities.CryptoTransaction.update(payment.id, { status: 'expired' });
      return { payment: expired, message: 'This quote expired before a transaction was submitted.' };
    }
    return { payment, message: '' };
  }

  const check = await checkChain(payment);
  const required = check.required || requiredFor(payment.network);
  const complete =
    check.found && !check.error && check.confirmations >= required && check.amount + 1e-9 >= Number(payment.amount);

  const updates = {
    network: payment.network,
    deposit_address: payment.deposit_address || payment.address || '',
    confirmations: check.confirmations || 0,
    required_confirmations: required,
    status: complete ? 'confirmed' : check.found && check.error ? 'failed' : 'verifying',
  };

  const updated = await base44.asServiceRole.entities.CryptoTransaction.update(payment.id, updates);
  if (!complete) return { payment: updated, message: check.error || '' };

  const credited = await creditOnce(base44, updated);
  return { payment: credited, message: '' };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');

    if (action === 'quote') {
      const coin = String(body.coin || '').toUpperCase();
      const network = String(body.network || '').toLowerCase();
      const amount = round(Number(body.amount || 0), coin);

      if (!COINS.includes(coin)) return Response.json({ error: 'Unsupported coin.' }, { status: 400 });
      if (!(COIN_NETWORKS[coin] || []).includes(network)) {
        return Response.json({ error: 'That coin is not supported on that network.' }, { status: 400 });
      }
      if (!(amount > 0)) return Response.json({ error: 'Enter the amount you are sending.' }, { status: 400 });

      const addresses = await asRows(
        base44.asServiceRole.entities.DepositAddress.filter({ coin, network, active: true }),
      );
      const deposit = addresses.find((row) => String(row.address || '').trim());
      if (!deposit) {
        return Response.json({ error: 'No active deposit address for that coin and network.' }, { status: 400 });
      }

      const price = await fetchPrice(coin);
      if (!(price > 0)) {
        return Response.json({ error: 'Could not price that coin right now. Try again shortly.' }, { status: 502 });
      }

      const address = String(deposit.address).trim();
      const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();
      const required = requiredFor(network);

      const transaction = await base44.asServiceRole.entities.CryptoTransaction.create({
        user_id: user.id,
        user_handle: handleFor(user),
        kind: 'deposit',
        coin,
        network,
        amount,
        amount_usd: Math.round(amount * price * 100) / 100,
        tx_hash: '',
        address,
        deposit_address: address,
        status: 'awaiting_tx',
        quote_expires_at: expiresAt,
        confirmations: 0,
        required_confirmations: required,
        credited: false,
        review_note: '',
        reviewed_by: '',
      });

      return Response.json({
        payment_id: transaction.id,
        address,
        amount,
        coin,
        network,
        amount_usd: transaction.amount_usd,
        expires_at: expiresAt,
        confirmations: 0,
        required_confirmations: required,
        status: 'awaiting_tx',
      });
    }

    if (action === 'submit') {
      const payment = await loadPayment(base44, String(body.payment_id || '').trim());
      if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });
      if (!canAccess(payment, user)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (payment.credited) return Response.json({ payment: snapshot(payment) });

      const txHash = String(body.tx_hash || '').trim();
      if (!txHash) return Response.json({ error: 'Paste the transaction hash.' }, { status: 400 });

      const others = await asRows(base44.asServiceRole.entities.CryptoTransaction.filter({ tx_hash: txHash }));
      if (others.some((row) => row.id !== payment.id)) {
        return Response.json({ error: 'That transaction hash is already on file.' }, { status: 400 });
      }

      const updated = await base44.asServiceRole.entities.CryptoTransaction.update(payment.id, {
        tx_hash: txHash,
        status: 'verifying',
      });
      const result = await runVerify(base44, updated);
      return Response.json({ payment: snapshot(result.payment), message: result.message });
    }

    if (action === 'verify') {
      const payment = await loadPayment(base44, String(body.payment_id || '').trim());
      if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });
      if (!canAccess(payment, user)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const result = await runVerify(base44, payment);
      return Response.json({ payment: snapshot(result.payment), message: result.message });
    }

    if (action === 'status') {
      const payment = await loadPayment(base44, String(body.payment_id || '').trim());
      if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });
      if (!canAccess(payment, user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

      let current = payment;
      if (
        current.status === 'awaiting_tx' &&
        current.quote_expires_at &&
        new Date(current.quote_expires_at).getTime() < Date.now()
      ) {
        current = await base44.asServiceRole.entities.CryptoTransaction.update(current.id, { status: 'expired' });
      }
      return Response.json({ payment: snapshot(current) });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}