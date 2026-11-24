import { Address } from 'viem';

export interface B20StockMetadata {
  symbol: string;
  name: string;
  ticker: string;
  address: Record<number, Address>;
  decimals: number;
  iconUrl: string;
  referencePriceUsd: number;
}

export const VERIFIED_B20_STOCKS: B20StockMetadata[] = [
  {
    symbol: 'bCOIN',
    name: 'Coinbase Global, Inc.',
    ticker: 'COIN',
    decimals: 18,
    iconUrl: '/tokens/coin.svg',
    referencePriceUsd: 250.0,
    address: {
      84532: '0xB91fcC29d586E2F8326d4E956160f3FDf289d1c5', // Base Sepolia Live MockB20Stock
      8453: '0x0000000000000000000000000000000000000001',  // Pending Base Mainnet Official B20
    },
  },
  {
    symbol: 'bNVDA',
    name: 'NVIDIA Corporation',
    ticker: 'NVDA',
    decimals: 18,
    iconUrl: '/tokens/nvda.svg',
    referencePriceUsd: 140.0,
    address: {
      84532: '0x1ad0e455458a67B91aae2d4C6cc9EF1CCc493EA5', // Base Sepolia Live MockB20Stock
      8453: '0x0000000000000000000000000000000000000002',  // Pending Base Mainnet Official B20
    },
  },
  {
    symbol: 'bAAPL',
    name: 'Apple Inc.',
    ticker: 'AAPL',
    decimals: 18,
    iconUrl: '/tokens/aapl.svg',
    referencePriceUsd: 230.0,
    address: {
      84532: '0xC31f5a66b19EbD0039fd0e3Ad31E6D0c57b017D2', // Base Sepolia Live MockB20Stock
      8453: '0x0000000000000000000000000000000000000003',
    },
  },
  {
    symbol: 'bTSLA',
    name: 'Tesla, Inc.',
    ticker: 'TSLA',
    decimals: 18,
    iconUrl: '/tokens/tsla.svg',
    referencePriceUsd: 340.0,
    address: {
      84532: '0xa855bBe14a6b67487717cCB0E0cFa3A0fbEe9007', // Base Sepolia Live MockB20Stock
      8453: '0x0000000000000000000000000000000000000004',
    },
  },
];
