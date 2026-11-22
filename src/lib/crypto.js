export const NETWORKS = [
  { id: 'bitcoin', label: 'Bitcoin', required: 2, coins: ['BTC'], hint: 'Legacy, SegWit or Taproot address' },
  { id: 'ethereum', label: 'Ethereum', required: 6, coins: ['ETH', 'USDC', 'USDT'], hint: 'Native ETH, USDC or USDT' },
  { id: 'base', label: 'Base', required: 6, coins: ['USDC'], hint: 'USDC on Base' },
  { id: 'polygon', label: 'Polygon', required: 6, coins: ['USDC', 'USDT'], hint: 'USDC or USDT on Polygon' },
  {
    id: 'solana',
    label: 'Solana',
    required: 1,
    coins: ['USDC', 'USDT'],
    hint: 'A native SOL transfer, credited in the stablecoin you quote',
  },
];

export const EXPLORERS = {
  bitcoin: 'https://blockstream.info/tx/',
  ethereum: 'https://etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  polygon: 'https://polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/',
};

export const networkById = (id) => NETWORKS.find((n) => n.id === id) || null;

export const networksForCoin = (coin) => NETWORKS.filter((n) => n.coins.includes(coin));

export const requiredFor = (id) => {
  const network = networkById(id);
  return network ? network.required : 6;
};

export const pairKey = (coin, network) => `${coin}:${network}`;

export const explorerUrl = (network, hash) => {
  if (!hash) return '';
  const base = EXPLORERS[network];
  return base ? `${base}${hash}` : '';
};

export const looksLikeAddress = (network, address) => {
  const value = String(address || '').trim();
  if (!value) return false;
  if (network === 'bitcoin') return /^(bc1[a-zA-HJ-NP-Z0-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(value);
  if (network === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  return /^0x[0-9a-fA-F]{40}$/.test(value);
};

export const shortHash = (hash) => (hash && hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash || '');