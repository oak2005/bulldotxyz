'use client';

import React from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { connectorsForWallets, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import {
  injectedWallet,
  baseAccount,
  coinbaseWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  trustWallet,
  okxWallet,
  rabbyWallet,
  phantomWallet,
  zerionWallet,
  uniswapWallet,
  bitgetWallet,
  binanceWallet,
  braveWallet,
  safepalWallet,
  tokenPocketWallet,
  safeWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, WagmiProvider, http, fallback } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ProtocolProvider } from './context/ProtocolContext';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'a0b9435b866504a29a07119ff339e802';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended & Browser',
      wallets: [
        injectedWallet,
        baseAccount,
        coinbaseWallet,
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
      ],
    },
    {
      groupName: 'More EVM Wallets',
      wallets: [
        trustWallet,
        okxWallet,
        rabbyWallet,
        phantomWallet,
        zerionWallet,
        uniswapWallet,
        bitgetWallet,
        binanceWallet,
        braveWallet,
        safepalWallet,
        tokenPocketWallet,
        safeWallet,
      ],
    },
  ],
  {
    appName: 'bulldotxyz',
    appDescription:
      'Base DEX & fair launchpad paired with Coinbase B20 tokenized stocks.',
    appUrl: 'https://bulldot.xyz',
    projectId: walletConnectProjectId,
  }
);

const config = createConfig({
  connectors,
  chains: [baseSepolia, base],
  multiInjectedProviderDiscovery: true,
  transports: {
    [baseSepolia.id]: fallback([
      http('https://base-sepolia-rpc.publicnode.com'),
      http('https://sepolia.base.org'),
    ]),
    [base.id]: fallback([
      http('https://base-rpc.publicnode.com'),
      http('https://mainnet.base.org'),
    ]),
  },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={baseSepolia}
          modalSize="compact"
          theme={darkTheme({
            accentColor: '#0052FF',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
        >
          <ProtocolProvider>
            {children}
          </ProtocolProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
