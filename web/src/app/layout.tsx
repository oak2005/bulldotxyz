import './globals.css';
import React from 'react';
import type { Metadata } from 'next';
import { Providers } from '../providers';
import { Header } from '../components/Header';

export const metadata: Metadata = {
  title: 'bulldotxyz — Simple, Reliable DEX & Launchpad on Base',
  description: 'Trade and launch community tokens exclusively paired with Coinbase tokenized stocks (B20 standard). Fully autonomous, permanent Uniswap v4 liquidity.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-gray-100 flex flex-col min-h-screen">
        <Providers>
          <Header />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="border-t border-border py-6 text-center text-xs text-gray-500">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
              <p>bulldot.xyz — Autonomous DEX & Launchpad on Base</p>
              <p className="flex items-center space-x-2">
                <span>Paired with Coinbase Tokenized Stocks (B20)</span>
                <span>•</span>
                <span className="text-primary">Permanent Uniswap v4 Liquidity</span>
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

