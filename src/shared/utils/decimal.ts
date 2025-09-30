import BigNumber from 'bignumber.js';

export function toLowestDenomination(value: string | number, decimals: number): string {
  const bn = new BigNumber(value);
  const multiplier = new BigNumber(10).pow(decimals);
  return bn.times(multiplier).toFixed(0);
}

export function fromLowestDenomination(value: string | number, decimals: number): string {
  const bn = new BigNumber(value);
  const divisor = new BigNumber(10).pow(decimals);
  return bn.div(divisor).toFixed();
}

export function getDecimalsForCurrency(tokenId: string): number {
  const currencyDecimals: Record<string, number> = {
    'slip44:0': 8, // BTC - 8 decimals (satoshi)
    'slip44:60': 18, // ETH - 18 decimals (wei)
    'slip44:714': 18, // BNB - 18 decimals
    'slip44:501': 9, // SOL - 9 decimals (lamports)
    'iso4217:usd': 6, // USD - 6 decimals (standard for USDC/USDT)
  };

  return currencyDecimals[tokenId] ?? 18; // Default to 18 decimals if not found
}
