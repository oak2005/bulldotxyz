import { Address } from 'viem';

export interface ProtocolDeployment {
  chainId: number;
  networkName: string;
  poolManager: Address;
  positionManager: Address;
  permit2: Address;
  factory: Address;
  router: Address;
  feeVault: Address;
  b20Registry: Address;
  explorerUrl: string;
}

export const CONTRACT_CONFIGS: Record<number, ProtocolDeployment> = {
  // Base Sepolia (Chain ID 84532)
  84532: {
    chainId: 84532,
    networkName: 'Base Sepolia',
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
    positionManager: '0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    factory: '0x1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B',
    router: '0x2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C',
    feeVault: '0x3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D',
    b20Registry: '0x0000000000000000000000000000000000000000',
    explorerUrl: 'https://sepolia.basescan.org',
  },
  // Base Mainnet (Chain ID 8453)
  8453: {
    chainId: 8453,
    networkName: 'Base Mainnet',
    poolManager: '0x498581fF718922c3f8e6Ac1447f5c0994264F0F9',
    positionManager: '0x7C40c31F41609b77Ecdc5222E42b8e3a2B79A63f',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    factory: '0x0000000000000000000000000000000000000000', // Update after mainnet broadcast
    router: '0x0000000000000000000000000000000000000000',
    feeVault: '0x0000000000000000000000000000000000000000',
    b20Registry: '0x0000000000000000000000000000000000000000',
    explorerUrl: 'https://basescan.org',
  },
};
