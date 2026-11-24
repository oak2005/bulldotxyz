import { Address } from 'viem';

export interface ProtocolDeployment {
  chainId: number;
  networkName: string;
  poolManager: Address;
  positionManager: Address;
  permit2: Address;
  factory: Address;
  curveDeployer: Address;
  router: Address;
  feeVault: Address;
  b20Registry: Address;
  deploymentBlock: bigint;
  explorerUrl: string;
}

export const CONTRACT_CONFIGS: Record<number, ProtocolDeployment> = {
  // Base Sepolia (Chain ID 84532) — Live On-Chain Deployment
  84532: {
    chainId: 84532,
    networkName: 'Base Sepolia',
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
    positionManager: '0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    factory: '0xF74565Da7C686C3c23057A3A5Fc8782340e769A2',
    curveDeployer: '0x677e6430D98c48157928a16Ec109f3B06C3cE39E',
    router: '0x9B02cfc05e0fC3289a5584679F4ae171ceF68752',
    feeVault: '0x9bdaaC49737F20b8f04B2ea8692B737c35A72776',
    b20Registry: '0x098C0d1E4d7C8713EF1d92B2D3c67Cc923634C87',
    deploymentBlock: BigInt(63197400),
    explorerUrl: 'https://sepolia.basescan.org',
  },
  // Base Mainnet (Chain ID 8453) — Paused pending official Coinbase B20 rollout
  8453: {
    chainId: 8453,
    networkName: 'Base Mainnet',
    poolManager: '0x498581fF718922c3f8e6Ac1447f5c0994264F0F9',
    positionManager: '0x7C40c31F41609b77Ecdc5222E42b8e3a2B79A63f',
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    factory: '0x0000000000000000000000000000000000000000',
    curveDeployer: '0x0000000000000000000000000000000000000000',
    router: '0x0000000000000000000000000000000000000000',
    feeVault: '0x0000000000000000000000000000000000000000',
    b20Registry: '0x0000000000000000000000000000000000000000',
    deploymentBlock: BigInt(0),
    explorerUrl: 'https://basescan.org',
  },
};
