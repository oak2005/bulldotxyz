'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Check, ChevronDown, ChevronUp, Droplets, Rocket, ArrowRightLeft, Wallet } from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useProtocol } from '../context/ProtocolContext';
import { snappySpring, TactileButton, TactileLink } from './MotionPrimitives';

export function OnboardingGuide() {
  const { isConnected, chainId: connectedChainId } = useAccount();
  const configChainId = useChainId();
  const isOnBaseSepolia = isConnected && (connectedChainId ?? configChainId) === baseSepolia.id;
  const {
    ethBalance,
    stockBalances,
    tokenBalances,
    communityTokens,
    setIsFaucetOpen,
  } = useProtocol();

  const [collapsed, setCollapsed] = useState(false);

  const hasGasOrStocks =
    ethBalance > 0 || Object.values(stockBalances).some((b) => (b || 0) > 0);
  const hasPoolOnChain = communityTokens.length > 0;
  const hasTraded =
    Object.values(tokenBalances).some((b) => (b || 0) > 0) ||
    communityTokens.some((t) => t.volumeB20 > 0);

  const steps = [
    {
      id: 'wallet',
      title: 'Connect Base Sepolia',
      detail: 'Link any EVM wallet to network 84532',
      done: isOnBaseSepolia,
      icon: Wallet,
    },
    {
      id: 'assets',
      title: 'Hold ETH or B20 Stock',
      detail: 'Swap directly with ETH or claim test equity',
      done: isConnected && hasGasOrStocks,
      icon: Droplets,
    },
    {
      id: 'launch',
      title: 'Deploy Equity Curve',
      detail: 'Launch zero-capital fair curve',
      done: hasPoolOnChain,
      icon: Rocket,
    },
    {
      id: 'swap',
      title: 'Trade 2-Hop Route',
      detail: 'Buy or sell via ETH ↔ Stock ↔ Token',
      done: hasTraded,
      icon: ArrowRightLeft,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0E141C]/90 backdrop-blur-md overflow-hidden shadow-tactile-card">
      {/* Header Row */}
      <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-micro bg-[#0052FF]/15 text-[#7CA8FF] border border-[#0052FF]/35">
            Quick Start
          </span>
          <span className="text-xs font-medium text-ink">
            Interactive Testnet Walkthrough{' '}
            <span className="font-mono text-[#00E599] ml-1 tabular-nums">
              {completedCount}/4
            </span>
          </span>
          <div className="hidden sm:block w-24 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={snappySpring}
              className="h-full rounded-full bg-gradient-to-r from-[#0052FF] to-[#00E599]"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!isConnected ? (
            <ConnectButton chainStatus="none" showBalance={false} label="Connect Wallet" />
          ) : !hasGasOrStocks ? (
            <TactileButton
              variant="emerald"
              onClick={() => setIsFaucetOpen(true)}
              className="px-3 py-1.5 text-[11px] space-x-1.5"
            >
              <Droplets className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Claim Test Stock</span>
            </TactileButton>
          ) : !hasPoolOnChain ? (
            <TactileLink href="/launch" variant="primary" className="px-3 py-1.5 text-[11px] space-x-1.5">
              <Rocket className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Launch First Token</span>
            </TactileLink>
          ) : null}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Toggle onboarding checklist"
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4" strokeWidth={1.6} />
            ) : (
              <ChevronUp className="w-4 h-4" strokeWidth={1.6} />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Interactive Grid */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={snappySpring}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const actionHref =
                  step.id === 'launch' ? '/launch' : step.id === 'swap' ? '/' : undefined;
                const inner = (
                  <div
                    className={`p-3 rounded-xl border transition-colors flex items-start space-x-2.5 h-full ${
                      step.done
                        ? 'bg-[#00E599]/[0.06] border-[#00E599]/30'
                        : 'bg-[#080B10]/70 border-white/[0.06] hover:border-[#0052FF]/40'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        step.done
                          ? 'bg-[#00E599] text-[#05120D]'
                          : 'bg-[#141C27] text-muted border border-white/[0.08]'
                      }`}
                    >
                      {step.done ? (
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      ) : (
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-[10px] text-muted">0{i + 1}</span>
                        <span
                          className={`text-xs font-semibold truncate ${
                            step.done ? 'text-[#00E599]' : 'text-ink'
                          }`}
                        >
                          {step.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5 leading-snug">{step.detail}</p>
                    </div>
                  </div>
                );

                if (step.id === 'assets' && !step.done) {
                  return (
                    <button
                      key={step.id}
                      onClick={() => setIsFaucetOpen(true)}
                      className="text-left"
                    >
                      {inner}
                    </button>
                  );
                }
                if (actionHref && !step.done) {
                  return (
                    <Link key={step.id} href={actionHref}>
                      {inner}
                    </Link>
                  );
                }
                return <div key={step.id}>{inner}</div>;
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

