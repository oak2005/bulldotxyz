import { defineChain } from 'viem';
import { base, baseSepolia } from 'viem/chains';

export const supportedChains = [baseSepolia, base] as const;

export const defaultChain = process.env.NEXT_PUBLIC_DEFAULT_CHAIN === '8453' 
  ? base 
  : baseSepolia;

export function getChainConfig(chainId: number) {
  if (chainId === base.id) {
    return {
      chain: base,
      explorerUrl: 'https://basescan.org',
      rpcUrl: 'https://mainnet.base.org',
    };
  }
  return {
    chain: baseSepolia,
    explorerUrl: 'https://sepolia.basescan.org',
    rpcUrl: 'https://sepolia.base.org',
  };
}
