'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import {
  AlertTriangle,
  Droplets,
  Pause,
  CheckCircle2,
  X,
  ExternalLink,
  ShieldAlert,
  Menu,
  Rocket,
  Layers,
  Building2,
  ArrowRightLeft,
} from 'lucide-react';
import { useProtocol } from '../context/ProtocolContext';

export function Header() {
  const pathname = usePathname();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { isConnected } = useAccount();
  const {
    stockBalances,
    claimFaucet,
    isFaucetOpen,
    setIsFaucetOpen,
    faucetSuccessMsg,
    faucetTxHash,
    clearFaucetMsg,
  } = useProtocol();

  const isSepolia = chainId === baseSepolia.id;
  const isMainnet = chainId === base.id;
  const isSupported = isSepolia || isMainnet;

  const [selectedStock, setSelectedStock] = useState('bCOIN');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);
  const [claimingProgress, setClaimingProgress] = useState<string | null>(null);
  const [faucetError, setFaucetError] = useState<string | null>(null);

  const handleSingleFaucetClaim = async () => {
    setIsClaimingFaucet(true);
    setFaucetError(null);
    setClaimingProgress(`Confirm +100 ${selectedStock} in wallet...`);
    try {
      await claimFaucet(selectedStock);
    } catch (err: any) {
      setFaucetError(err?.message || 'Faucet claim failed.');
    } finally {
      setIsClaimingFaucet(false);
      setClaimingProgress(null);
    }
  };

  const handleBatchFaucetClaim = async () => {
    const syms = ['bCOIN', 'bNVDA', 'bAAPL', 'bTSLA'];
    setIsClaimingFaucet(true);
    setFaucetError(null);
    try {
      for (let i = 0; i < syms.length; i++) {
        setClaimingProgress(`Claiming ${syms[i]} (${i + 1}/4) in wallet...`);
        await claimFaucet(syms[i]);
      }
    } catch (err: any) {
      setFaucetError(err?.message || 'Starter pack interrupted or cancelled.');
    } finally {
      setIsClaimingFaucet(false);
      setClaimingProgress(null);
    }
  };

  const navLinks = [
    { label: 'Trade / Swap', href: '/', icon: ArrowRightLeft },
    { label: 'Launch Token', href: '/launch', icon: Rocket },
    { label: 'Explore Pools', href: '/explore', icon: Layers },
    { label: 'Creator Hub', href: '/dashboard', icon: Building2 },
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
          {/* Brand & Desktop Nav */}
          <div className="flex items-center space-x-6 lg:space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl">🐂</span>
              <span className="font-bold text-xl tracking-tight text-white">
                bulldot<span className="text-primary">.xyz</span>
              </span>
            </Link>

            {/* Navigation Links (Desktop) */}
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
            {/* Testnet Stock Faucet Pill (Desktop / Tablet) */}
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
                    <span className="hidden sm:inline">Switch to Base Sepolia</span>
                    <span className="sm:hidden">Wrong Net</span>
                  </button>
                ) : isSepolia ? (
                  <button
                    onClick={() => switchChain?.({ chainId: base.id })}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/40 transition-colors"
                    title="Active on Base Sepolia Testnet. Click to view Mainnet state."
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold hidden sm:inline">Base Sepolia (Testnet)</span>
                    <span className="font-semibold sm:hidden">Sepolia</span>
                  </button>
                ) : (
                  <button
                    onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border bg-zinc-900/80 text-zinc-400 border-zinc-700 hover:bg-zinc-800 transition-colors"
                    title="Mainnet contracts are paused. Click to switch to Base Sepolia Testnet."
                  >
                    <Pause className="w-3 h-3 text-amber-500" />
                    <span className="hidden sm:inline">Base Mainnet (Paused)</span>
                    <span className="sm:hidden">Paused</span>
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

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-border bg-surface text-gray-300 hover:text-white hover:bg-surface-hover transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-surface border-b border-border px-4 py-4 space-y-3 animate-fadeIn">
            <div className="grid grid-cols-2 gap-2">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`p-3 rounded-xl flex items-center space-x-2 text-xs font-semibold border transition-all ${
                      active
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-background/60 text-gray-300 border-border hover:border-gray-600 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-primary" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Faucet Callout */}
            {isSepolia && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsFaucetOpen(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-semibold text-xs flex items-center justify-center space-x-2"
              >
                <Droplets className="w-4 h-4 text-emerald-400" />
                <span>Open Testnet Stock Faucet (+100 bCOIN)</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* Stock Faucet Modal */}
      {isFaucetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                  <Droplets className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Base Sepolia Stock Faucet</h3>
                  <p className="text-xs text-gray-400">Claim testnet tokenized equities for testing</p>
                </div>
              </div>
              <button
                onClick={() => setIsFaucetOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-background transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Faucet Notification */}
            {faucetSuccessMsg && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{faucetSuccessMsg}</span>
                </div>
                {faucetTxHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${faucetTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 underline hover:text-white shrink-0"
                  >
                    <span>BaseScan</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {faucetError && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-center space-x-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{faucetError}</span>
              </div>
            )}

            {/* Balances summary */}
            <div className="p-3.5 bg-background border border-border/80 rounded-xl space-y-2">
              <span className="text-xs text-gray-400 font-medium block">Your Current Testnet Equities:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {['bCOIN', 'bNVDA', 'bAAPL', 'bTSLA'].map((sym) => (
                  <div key={sym} className="flex justify-between p-2 rounded-lg bg-surface border border-border">
                    <span className="text-gray-400">{sym}:</span>
                    <span className="font-bold text-white">{stockBalances[sym]?.toFixed(1) || '0.0'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stock selector to claim */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 block">Select Asset to Claim (+100 Tokens):</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { sym: 'bCOIN', name: 'Coinbase Stock' },
                  { sym: 'bNVDA', name: 'Nvidia Stock' },
                  { sym: 'bAAPL', name: 'Apple Stock' },
                  { sym: 'bTSLA', name: 'Tesla Stock' },
                ].map((item) => (
                  <button
                    key={item.sym}
                    onClick={() => setSelectedStock(item.sym)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedStock === item.sym
                        ? 'border-emerald-500 bg-emerald-950/40 text-white font-bold'
                        : 'border-border bg-background/50 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <span className="block text-xs font-bold">{item.sym}</span>
                    <span className="block text-[10px] text-gray-400">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Claim Action */}
            <div className="pt-2 space-y-2">
              <button
                disabled={!isConnected || isClaimingFaucet}
                onClick={handleSingleFaucetClaim}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-surface-hover disabled:text-gray-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-2"
              >
                <Droplets className="w-4 h-4" />
                <span>
                  {!isConnected
                    ? 'Connect Wallet to Claim On-Chain'
                    : claimingProgress
                    ? claimingProgress
                    : `Claim +100 ${selectedStock} On-Chain`}
                </span>
              </button>

              <button
                disabled={!isConnected || isClaimingFaucet}
                onClick={handleBatchFaucetClaim}
                className="w-full py-2 bg-surface hover:bg-surface-hover disabled:text-gray-500 border border-border text-gray-300 rounded-xl font-semibold text-xs transition-colors"
              >
                Claim All 4 Testnet Stocks (4 On-Chain Txs)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
