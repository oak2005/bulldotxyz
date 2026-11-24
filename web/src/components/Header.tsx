'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { AlertTriangle, Droplets, Pause, CheckCircle2, X, ExternalLink, ShieldAlert } from 'lucide-react';
import { useProtocol } from '../context/ProtocolContext';

export function Header() {
  const pathname = usePathname();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { isConnected } = useAccount();
  const { stockBalances, claimFaucet, isFaucetOpen, setIsFaucetOpen, faucetSuccessMsg, clearFaucetMsg } = useProtocol();

  const isSepolia = chainId === baseSepolia.id;
  const isMainnet = chainId === base.id;
  const isSupported = isSepolia || isMainnet;

  const [selectedStock, setSelectedStock] = useState('bCOIN');

  const navLinks = [
    { label: 'Trade / Swap', href: '/' },
    { label: 'Launch Token', href: '/launch' },
    { label: 'Explore Pools', href: '/explore' },
    { label: 'Creator Hub', href: '/dashboard' },
  ];

  return (
    <>
      {/* Persistent Mainnet Paused Banner */}
      {isMainnet && (
        <div className="bg-amber-950/90 border-b border-amber-800 text-amber-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 z-50">
          <div className="flex items-center space-x-2">
            <Pause className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Base Mainnet Contracts Paused:</strong> Mainnet trading is paused pending Coinbase's official B20 tokenized equity deployments. Switch to Base Sepolia Testnet to test live DEX swaps, launches, and fee redirection with testnet stocks.
            </span>
          </div>
          <button
            onClick={() => switchChain?.({ chainId: baseSepolia.id })}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors whitespace-nowrap"
          >
            Switch to Base Sepolia Testnet
          </button>
        </div>
      )}

      {/* Global Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
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
                        ? 'bg-surface text-white border border-border shadow-sm'
                        : 'text-gray-400 hover:text-white hover:bg-surface/50'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Testnet Stock Faucet Pill (Only visible on Base Sepolia) */}
            {isSepolia && (
              <button
                onClick={() => setIsFaucetOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/60 transition-all shadow-sm"
                title="Claim free Base Sepolia testnet stocks (bCOIN, bNVDA, etc.)"
              >
                <Droplets className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Stock Faucet</span>
                <span className="sm:hidden">Faucet</span>
              </button>
            )}

            {/* Network Selector Pill */}
            {isConnected && (
              <>
                {!isSupported ? (
                  <button
                    onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-300 border border-red-800 hover:bg-red-900/60 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span>Switch to Base Sepolia</span>
                  </button>
                ) : isSepolia ? (
                  <button
                    onClick={() => switchChain?.({ chainId: base.id })}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/40 transition-colors"
                    title="Active on Base Sepolia Testnet. Click to view Mainnet state."
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold">Base Sepolia (Testnet)</span>
                  </button>
                ) : (
                  <button
                    onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border bg-zinc-900/80 text-zinc-400 border-zinc-700 hover:bg-zinc-800 transition-colors"
                    title="Mainnet contracts are paused. Click to switch to Base Sepolia Testnet."
                  >
                    <Pause className="w-3 h-3 text-amber-500" />
                    <span>Base Mainnet (Paused)</span>
                  </button>
                )}
              </>
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

      {/* Stock Faucet Modal */}
      {isFaucetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-400">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Testnet Stock Faucet</h3>
                  <p className="text-xs text-gray-400">Base Sepolia (Chain ID: 84532)</p>
                </div>
              </div>
              <button
                onClick={() => setIsFaucetOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-background"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {faucetSuccessMsg && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{faucetSuccessMsg}</span>
              </div>
            )}

            <p className="text-xs text-gray-300 leading-relaxed">
              Mint mock Coinbase Tokenized Stocks (B20 standard) on Base Sepolia to test swaps on the DEX, launch tokens with initial capital, or trade along fair launch bonding curves.
            </p>

            {/* Current Balances Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-background/60 border border-border rounded-xl">
                <span className="text-gray-400 block text-[11px]">bCOIN Balance</span>
                <span className="text-sm font-bold text-white">{(stockBalances.bCOIN || 0).toFixed(2)} bCOIN</span>
              </div>
              <div className="p-3 bg-background/60 border border-border rounded-xl">
                <span className="text-gray-400 block text-[11px]">bNVDA Balance</span>
                <span className="text-sm font-bold text-white">{(stockBalances.bNVDA || 0).toFixed(2)} bNVDA</span>
              </div>
              <div className="p-3 bg-background/60 border border-border rounded-xl">
                <span className="text-gray-400 block text-[11px]">bAAPL Balance</span>
                <span className="text-sm font-bold text-white">{(stockBalances.bAAPL || 0).toFixed(2)} bAAPL</span>
              </div>
              <div className="p-3 bg-background/60 border border-border rounded-xl">
                <span className="text-gray-400 block text-[11px]">bTSLA Balance</span>
                <span className="text-sm font-bold text-white">{(stockBalances.bTSLA || 0).toFixed(2)} bTSLA</span>
              </div>
            </div>

            {/* Select Stock To Mint */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">Select Stock Asset to Claim (+100 Tokens):</label>
              <div className="grid grid-cols-4 gap-2 text-xs font-semibold">
                {['bCOIN', 'bNVDA', 'bAAPL', 'bTSLA'].map((sym) => (
                  <button
                    key={sym}
                    onClick={() => setSelectedStock(sym)}
                    className={`py-2 rounded-xl border transition-all ${
                      selectedStock === sym
                        ? 'border-emerald-500 bg-emerald-950/60 text-emerald-300'
                        : 'border-border bg-background/40 text-gray-400 hover:text-white'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>

            {/* Action */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => claimFaucet(selectedStock, 100)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-1.5"
              >
                <Droplets className="w-4 h-4" />
                <span>Claim 100 {selectedStock} Testnet Tokens</span>
              </button>

              <button
                onClick={() => {
                  claimFaucet('bCOIN', 100);
                  claimFaucet('bNVDA', 50);
                  claimFaucet('bAAPL', 50);
                  claimFaucet('bTSLA', 50);
                }}
                className="w-full py-2 bg-background/60 hover:bg-background border border-border text-gray-300 rounded-xl text-[11px] font-semibold transition-colors"
              >
                Claim Starter Bundle (100 bCOIN + 50 bNVDA + 50 bAAPL + 50 bTSLA)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
