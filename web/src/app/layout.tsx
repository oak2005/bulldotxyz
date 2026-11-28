import './globals.css';
import React from 'react';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Providers } from '../providers';
import { Header } from '../components/Header';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { BulldotLogo } from '../components/BrandAssets';
import { CONTRACT_CONFIGS } from '../config/contracts';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#080B10',
};

export const metadata: Metadata = {
  title: 'bulldotxyz — Base DEX & Launchpad Paired With Coinbase Equities',
  description:
    'Launch and trade community tokens backed by Coinbase B20 tokenized stocks on Base. Atomic 2-hop ETH swaps, multiplier-invariant bonding curves, and permanent Uniswap v4 liquidity.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-ink flex flex-col min-h-screen relative selection:bg-primary/30 selection:text-white">
        {/* Directional ambient lighting + architectural surface texture */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-horizon-wash" />
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-arch-grid" />
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-grain" />

        <div className="relative z-10 flex flex-col min-h-screen">
          <Providers>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-9 pb-28 md:pb-12">
              {children}
            </main>
            <MobileBottomNav />
            <footer className="border-t border-border bg-background/70 backdrop-blur-md py-8 text-xs text-muted mb-16 md:mb-0">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center space-x-3">
                  <BulldotLogo size={26} />
                  <div>
                    <p className="font-display font-semibold text-sm text-ink tracking-tight">
                      bulldot<span className="text-emeraldBrand">.xyz</span>
                    </p>
                    <p className="text-[11px] text-muted">
                      Equity-backed AMM &amp; Launchpad engineered natively on Base &amp; Uniswap v4.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
                  <Link href="/" className="hover:text-ink transition-colors">
                    Trade
                  </Link>
                  <Link href="/launch" className="hover:text-ink transition-colors">
                    Launchpad
                  </Link>
                  <Link href="/explore" className="hover:text-ink transition-colors">
                    Pools
                  </Link>
                  <Link href="/dashboard" className="hover:text-ink transition-colors">
                    Creator Hub
                  </Link>
                  <Link href="/docs" className="text-emeraldBrand hover:text-white font-medium transition-colors">
                    Documentation
                  </Link>
                  <a
                    href={`${CONTRACT_CONFIGS[84532].explorerUrl}/address/${CONTRACT_CONFIGS[84532].factory}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-muted hover:text-ink transition-colors"
                  >
                    Factory {CONTRACT_CONFIGS[84532].factory.slice(0, 6)}...{CONTRACT_CONFIGS[84532].factory.slice(-4)}
                  </a>
                </div>
              </div>
            </footer>
          </Providers>
        </div>
      </body>
    </html>
  );
}
