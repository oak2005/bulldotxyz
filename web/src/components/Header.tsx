'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';

export function Header() {
  const pathname = usePathname();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { isConnected } = useAccount();

  const isSepolia = chainId === baseSepolia.id;

  const navLinks = [
    { label: 'Trade / Swap', href: '/' },
    { label: 'Launch Token', href: '/launch' },
    { label: 'Explore Pools', href: '/explore' },
    { label: 'Creator Hub', href: '/dashboard' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">🐂</span>
            <span className="font-bold text-xl tracking-tight text-white">
              bulldot<span className="text-primary">.xyz</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-surface text-white border border-border'
                      : 'text-gray-400 hover:text-white hover:bg-surface/50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: Network Badge & Connect Button */}
        <div className="flex items-center space-x-3">
          {isConnected && (
            <button
              onClick={() => switchChain?.({ chainId: isSepolia ? base.id : baseSepolia.id })}
              className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isSepolia
                  ? 'bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/40'
                  : 'bg-blue-950/40 text-blue-300 border-blue-800/60 hover:bg-blue-900/40'
              }`}
              title="Click to toggle between Base Sepolia and Base Mainnet"
            >
              <span className={`w-2 h-2 rounded-full ${isSepolia ? 'bg-amber-400' : 'bg-blue-400'} animate-pulse`} />
              <span>{isSepolia ? 'Base Sepolia' : 'Base Mainnet'}</span>
            </button>
          )}

          <ConnectButton
            chainStatus="none"
            showBalance={false}
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'full',
            }}
          />
        </div>
      </div>
    </header>
  );
}

