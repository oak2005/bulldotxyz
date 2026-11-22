import { Address } from 'viem';

export interface B20StockMetadata {
  symbol: string;
  name: string;
  ticker: string;
  address: Record<number, Address>;
  decimals: number;
  iconUrl: string;
}

export const VERIFIED_B20_STOCKS: B20StockMetadata[] = [
  {
    symbol: 'bCOIN',
    name: 'Coinbase Global, Inc.',
    ticker: 'COIN',
    decimals: 18,
    iconUrl: '/tokens/coin.svg',
    address: {
      84532: '0x0000000000000000000000000000000000000001', // Base Sepolia Mock
      8453: '0x0000000000000000000000000000000000000001',  // Base Mainnet Official B20
    },
  },
  {
    symbol: 'bNVDA',
    name: 'NVIDIA Corporation',
    ticker: 'NVDA',
    decimals: 18,
    iconUrl: '/tokens/nvda.svg',
    address: {
      84532: '0x0000000000000000000000000000000000000002', // Base Sepolia Mock
      8453: '0x0000000000000000000000000000000000000002',  // Base Mainnet Official B20
    },
  },
  {
    symbol: 'bAAPL',
    name: 'Apple Inc.',
    ticker: 'AAPL',
    decimals: 18,
    iconUrl: '/tokens/aapl.svg',
    address: {
      84532: '0x0000000000000000000000000000000000000003',
      8453: '0x0000000000000000000000000000000000000003',
    },
  },
  {
    symbol: 'bTSLA',
    name: 'Tesla, Inc.',
    ticker: 'TSLA',
    decimals: 18,
    iconUrl: '/tokens/tsla.svg',
    address: {
      84532: '0x0000000000000000000000000000000000000004',
      8453: '0x0000000000000000000000000000000000000004',
    },
  },
];

