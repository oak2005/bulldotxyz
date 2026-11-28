'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Droplets,
  Pause,
  CheckCircle2,
  X,
  ExternalLink,
  Menu,
  Rocket,
  Layers,
  Building2,
  ArrowRightLeft,
  BookOpen,
} from 'lucide-react';
import { useProtocol } from '../context/ProtocolContext';
import { BulldotLogo, BaseNetworkMark, StockEquityBadge } from './BrandAssets';
import { TactileButton, snappySpring, gentleSpring } from './MotionPrimitives';

export function Header() {
  const pathname = usePathname();
  const configChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { isConnected, chainId: connectedChainId } = useAccount();
  const chainId = isConnected && connectedChainId ? connectedChainId : configChainId;
  const {
    ethBalance,
    stockBalances,
    claimFaucet,
    isFaucetOpen,
    setIsFaucetOpen,
    faucetSuccessMsg,
    faucetTxHash,
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
    { label: 'Trade', href: '/', icon: ArrowRightLeft },
    { label: 'Launch', href: '/launch', icon: Rocket },
    { label: 'Explore', href: '/explore', icon: Layers },
    { label: 'Creator', href: '/dashboard', icon: Building2 },
    { label: 'Docs', href: '/docs', icon: BookOpen },
  ];

  return (
    <>
      {/* Persistent Mainnet Paused or Wrong Network Banner */}
      <AnimatePresence>
        {isMainnet && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={gentleSpring}
            className="bg-amber-950/90 border-b border-amber-800/70 text-amber-200 px-4 py-2 text-xs z-50 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Pause className="w-4 h-4 text-amber-400 shrink-0" strokeWidth={1.6} />
                <span>
                  <strong className="text-white">Base Mainnet Paused:</strong> Mainnet pools are paused pending official Coinbase B20 rollout. Switch to Base Sepolia Testnet for live swaps and launches.
                </span>
              </div>
              <TactileButton
                variant="emerald"
                onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                className="px-3 py-1 text-[11px] rounded-lg whitespace-nowrap"
              >
                Switch to Base Sepolia
              </TactileButton>
            </div>
          </motion.div>
        )}
        {isConnected && !isSupported && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={gentleSpring}
            className="bg-[#0052FF]/20 border-b border-[#0052FF]/45 text-ink px-4 py-2 text-xs z-50 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-[#7CA8FF] shrink-0" strokeWidth={1.6} />
                <span>
                  Wallet connected on network <span className="font-mono text-white">#{chainId}</span>. Switch to <strong className="text-[#00E599]">Base Sepolia Testnet (84532)</strong> to trade and launch.
                </span>
              </div>
              <TactileButton
                variant="emerald"
                onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                className="px-3 py-1 text-[11px] rounded-lg whitespace-nowrap"
              >
                Switch to Base Sepolia
              </TactileButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Header */}
      <header className="sticky top-0 z-40 bg-[#080B10]/85 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand & Spring Navigation */}
          <div className="flex items-center space-x-6 lg:space-x-8">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <motion.div whileHover={{ rotate: -4, scale: 1.04 }} transition={snappySpring}>
                <BulldotLogo size={32} />
              </motion.div>
              <div className="flex items-baseline space-x-1.5">
                <span className="font-display font-semibold text-lg sm:text-xl tracking-display text-white">
                  bulldot<span className="text-[#00E599]">.xyz</span>
                </span>
                <span className="hidden lg:inline-block text-[10px] font-mono uppercase tracking-micro text-muted border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 rounded">
                  v4
                </span>
              </div>
            </Link>

            {/* Desktop Pill Nav with Framer Motion layoutId */}
            <nav className="hidden md:flex items-center p-1 rounded-xl bg-[#0E141C] border border-white/[0.07]">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active ? 'text-white' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="header-nav-pill"
                        transition={snappySpring}
                        className="absolute inset-0 rounded-lg bg-[#162030] border border-[#0052FF]/45 shadow-[0_0_16px_-4px_rgba(0,82,255,0.45)]"
                      />
                    )}
                    <span className="relative z-10 flex items-center space-x-1.5">
                      <span>{link.label}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
            {isSepolia && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={snappySpring}
                onClick={() => setIsFaucetOpen(true)}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30 hover:bg-[#00E599]/15 transition-colors"
                title="Claim free Base Sepolia testnet stocks (bCOIN, bNVDA, bAAPL, bTSLA)"
              >
                <Droplets className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Stock Faucet</span>
              </motion.button>
            )}

            {/* Network Pill */}
            {isConnected && (
              <>
                {!isSupported ? (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    transition={snappySpring}
                    onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                    className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium bg-red-950/60 text-red-300 border border-red-800/70 hover:bg-red-900/60 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" strokeWidth={1.6} />
                    <span className="hidden sm:inline">Switch to Base Sepolia</span>
                    <span className="sm:hidden">Wrong Net</span>
                  </motion.button>
                ) : isSepolia ? (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    transition={snappySpring}
                    onClick={() => switchChain?.({ chainId: base.id })}
                    className="flex items-center space-x-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium border bg-[#0052FF]/12 text-[#80AAFF] border-[#0052FF]/35 hover:bg-[#0052FF]/20 transition-colors"
                    title="Live on Base Sepolia Testnet. Click to inspect Base Mainnet state."
                  >
                    <BaseNetworkMark size={14} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] animate-pulse" />
                    <span className="font-medium hidden sm:inline">Base Sepolia</span>
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    transition={snappySpring}
                    onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border bg-surface text-muted border-white/10 hover:text-white transition-colors"
                    title="Mainnet paused. Click to switch back to Base Sepolia."
                  >
                    <Pause className="w-3 h-3 text-amber-400" strokeWidth={1.75} />
                    <span className="hidden sm:inline">Base (Paused)</span>
                    <span className="sm:hidden">Paused</span>
                  </motion.button>
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

            {/* Mobile Hamburger Toggle */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={snappySpring}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl border border-white/[0.08] bg-[#0E141C] text-muted hover:text-white transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" strokeWidth={1.6} />
              ) : (
                <Menu className="w-5 h-5" strokeWidth={1.6} />
              )}
            </motion.button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={snappySpring}
              className="md:hidden bg-[#0E141C] border-b border-white/[0.08] px-4 py-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const active = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`p-3 rounded-xl flex items-center space-x-2 text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-[#0052FF] text-white border-[#0052FF]'
                          : 'bg-[#080B10]/70 text-muted border-white/[0.08] hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" strokeWidth={1.6} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>

              {isSepolia && (
                <TactileButton
                  variant="emerald"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsFaucetOpen(true);
                  }}
                  className="w-full py-2.5 text-xs space-x-2"
                >
                  <Droplets className="w-4 h-4" strokeWidth={1.75} />
                  <span>Open Testnet Stock Faucet</span>
                </TactileButton>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Stock Faucet Modal */}
      <AnimatePresence>
        {isFaucetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={snappySpring}
              className="bg-[#0E141C] border border-white/[0.12] rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-tactile-card space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30">
                    <Droplets className="w-5 h-5" strokeWidth={1.6} />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-white tracking-tight">
                      Testnet Equity Faucet
                    </h3>
                    <p className="text-xs text-muted">
                      On-chain MockB20Stock minting on Base Sepolia
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFaucetOpen(false)}
                  className="text-muted hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>

              {faucetSuccessMsg && (
                <div className="p-3 bg-[#00E599]/10 border border-[#00E599]/35 rounded-xl text-xs text-[#00E599] flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                    <span>{faucetSuccessMsg}</span>
                  </div>
                  {faucetTxHash && (
                    <a
                      href={`https://sepolia.basescan.org/tx/${faucetTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 underline hover:text-white shrink-0 font-mono"
                    >
                      <span>Tx</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
                    </a>
                  )}
                </div>
              )}

              {faucetError && (
                <div className="p-3 bg-red-950/60 border border-red-800/70 rounded-xl text-xs text-red-300 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={1.6} />
                  <span>{faucetError}</span>
                </div>
              )}

              {/* Live Wallet Balances */}
              <div className="p-3.5 bg-[#080B10] border border-white/[0.07] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted font-medium">Wallet Balances</span>
                  <span className="font-mono text-ink tabular-nums">
                    {ethBalance.toFixed(4)} <span className="text-[#80AAFF]">ETH</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['bCOIN', 'bNVDA', 'bAAPL', 'bTSLA'].map((sym) => (
                    <div
                      key={sym}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#0E141C] border border-white/[0.06]"
                    >
                      <span className="text-muted">{sym}</span>
                      <span className="font-mono font-semibold text-white tabular-nums">
                        {(stockBalances[sym] || 0).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equity Selector */}
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-micro font-medium text-muted block">
                  Select Asset to Mint (+100 Shares)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { sym: 'bCOIN', name: 'Coinbase Global' },
                    { sym: 'bNVDA', name: 'NVIDIA Corp' },
                    { sym: 'bAAPL', name: 'Apple Inc.' },
                    { sym: 'bTSLA', name: 'Tesla, Inc.' },
                  ].map((item) => {
                    const active = selectedStock === item.sym;
                    return (
                      <motion.button
                        key={item.sym}
                        whileTap={{ scale: 0.98 }}
                        transition={snappySpring}
                        onClick={() => setSelectedStock(item.sym)}
                        className={`p-2.5 rounded-xl border text-left transition-colors flex items-center space-x-2.5 ${
                          active
                            ? 'border-[#00E599]/60 bg-[#00E599]/10 text-white'
                            : 'border-white/[0.07] bg-[#080B10]/60 text-muted hover:border-white/[0.14]'
                        }`}
                      >
                        <StockEquityBadge symbol={item.sym} size="sm" />
                        <div>
                          <span className="block text-xs font-semibold text-white">{item.sym}</span>
                          <span className="block text-[10px] text-muted">{item.name}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-1 space-y-2">
                <TactileButton
                  variant="emerald"
                  disabled={!isConnected || isClaimingFaucet}
                  onClick={handleSingleFaucetClaim}
                  className="w-full py-3 text-xs space-x-2"
                >
                  <Droplets className="w-4 h-4" strokeWidth={1.75} />
                  <span>
                    {!isConnected
                      ? 'Connect Wallet to Claim'
                      : claimingProgress
                      ? claimingProgress
                      : `Claim +100 ${selectedStock} On-Chain`}
                  </span>
                </TactileButton>

                <TactileButton
                  variant="secondary"
                  disabled={!isConnected || isClaimingFaucet}
                  onClick={handleBatchFaucetClaim}
                  className="w-full py-2.5 text-xs"
                >
                  Claim Starter Basket (4 On-Chain Txs)
                </TactileButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
