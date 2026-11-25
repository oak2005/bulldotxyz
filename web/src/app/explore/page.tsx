'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { VERIFIED_B20_STOCKS } from '../../config/stocks';
import { StockEquityBadge, TokenEmblem } from '../../components/BrandAssets';
import { SpotlightCard, TactileLink, Reveal, snappySpring } from '../../components/MotionPrimitives';
import { ShieldCheck, Flame, Rocket, ExternalLink, ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import { useProtocol } from '../../context/ProtocolContext';

export default function ExplorePage() {
  const { communityTokens, isLoadingPools, isSepolia } = useProtocol();
  const [filterStock, setFilterStock] = useState('ALL');
  const [filterMode, setFilterMode] = useState<'ALL' | 'V4' | 'CURVE'>('ALL');
  const explorerUrl = isSepolia ? 'https://sepolia.basescan.org' : 'https://basescan.org';

  const filtered = communityTokens.filter((t) => {
    const stockMatch = filterStock === 'ALL' || t.pairedStockSymbol === filterStock;
    const modeMatch =
      filterMode === 'ALL' ||
      (filterMode === 'V4' && (t.mode === 'GRADUATED' || t.mode === 'INSTANT')) ||
      (filterMode === 'CURVE' && t.mode === 'CURVE');
    return stockMatch && modeMatch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-micro text-[#7CA8FF]">
            On-Chain Market Directory
          </span>
          <h1 className="font-display text-3xl font-semibold text-white tracking-display mt-0.5">
            Explore Equity-Paired Pools
          </h1>
          <p className="text-sm text-muted mt-1">
            Verified community tokens launched directly via BulldotFactory on Base Sepolia.
          </p>
        </div>

        {/* Spring Mode Pills */}
        <div className="flex bg-[#0E141C] border border-white/[0.08] rounded-xl p-1 text-xs self-start">
          {[
            { id: 'ALL' as const, label: `All (${communityTokens.length})` },
            { id: 'V4' as const, label: 'Uniswap v4' },
            { id: 'CURVE' as const, label: 'Active Curves' },
          ].map((m) => {
            const active = filterMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setFilterMode(m.id)}
                className={`relative px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  active ? 'text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="explore-mode-pill"
                    transition={snappySpring}
                    className="absolute inset-0 rounded-lg bg-[#0052FF]"
                  />
                )}
                <span className="relative z-10">{m.label}</span>
              </button>
            );
          })}
        </div>
      </Reveal>

      {/* Equity Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] uppercase tracking-micro text-muted whitespace-nowrap">
          Paired Equity:
        </span>
        <button
          onClick={() => setFilterStock('ALL')}
          className={`px-3 py-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors ${
            filterStock === 'ALL'
              ? 'bg-[#00E599]/15 text-[#00E599] border-[#00E599]/40'
              : 'bg-[#0E141C] text-muted border-white/[0.08] hover:text-white'
          }`}
        >
          All Stocks
        </button>
        {VERIFIED_B20_STOCKS.map((s) => (
          <button
            key={s.symbol}
            onClick={() => setFilterStock(s.symbol)}
            className={`px-2.5 py-1 rounded-lg border transition-colors font-medium whitespace-nowrap flex items-center space-x-1.5 ${
              filterStock === s.symbol
                ? 'bg-[#00E599]/15 text-[#00E599] border-[#00E599]/40'
                : 'bg-[#0E141C] text-muted border-white/[0.08] hover:text-white'
            }`}
          >
            <StockEquityBadge symbol={s.symbol} size="sm" />
            <span>{s.symbol}</span>
          </button>
        ))}
      </div>

      {isLoadingPools && communityTokens.length === 0 ? (
        <SpotlightCard className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#00E599] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-muted">Syncing live token pools from Base Sepolia...</p>
        </SpotlightCard>
      ) : filtered.length === 0 ? (
        <SpotlightCard className="p-10 sm:p-14 text-center space-y-4">
          <div className="w-12 h-12 bg-[#0052FF]/15 border border-[#0052FF]/35 rounded-2xl flex items-center justify-center mx-auto text-[#7CA8FF]">
            <Layers className="w-6 h-6" strokeWidth={1.6} />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-display text-xl font-semibold text-white">0 Pools Active Yet</h3>
            <p className="text-xs text-muted leading-relaxed">
              No launched tokens match the current filter on Base Sepolia. Deploy the first community token paired with verified Coinbase B20 equities.
            </p>
          </div>
          <div className="pt-2">
            <TactileLink href="/launch" variant="emerald" className="px-5 py-2.5 text-xs space-x-1.5">
              <Rocket className="w-4 h-4" strokeWidth={1.75} />
              <span>Launch First Token</span>
            </TactileLink>
          </div>
        </SpotlightCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((token) => {
            const progress =
              token.mode === 'CURVE'
                ? Math.min(100, Math.round(((token.sharesAccumulated || 0) / (token.targetShares || 50)) * 100))
                : 100;
            const marketCapUsd = (token.b20Reserve * token.stockPriceUsd).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            });

            return (
              <SpotlightCard
                key={token.tokenAddress}
                outerClassName="hover:border-white/[0.14] transition-colors"
                className="p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <TokenEmblem symbol={token.symbol} size="md" />
                    <div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-display font-semibold text-white text-base tracking-tight">
                          {token.name}
                        </span>
                        <span className="text-xs text-muted font-mono">${token.symbol}</span>
                        <span className="inline-flex items-center gap-0.5 text-[#00E599] bg-[#00E599]/10 px-1.5 py-0.5 rounded text-[10px] font-mono border border-[#00E599]/30">
                          <ShieldCheck className="w-3 h-3" strokeWidth={1.6} />
                          Verified
                        </span>
                      </div>
                      <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                        <span>
                          Paired with <strong className="text-ink">{token.pairedStockSymbol}</strong>
                        </span>
                        {token.isTreasuryRedirected && (
                          <span className="text-[10px] font-mono text-[#00E599]">
                            • Stock Treasury Aligned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    {token.mode === 'CURVE' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-micro bg-[#0052FF]/15 text-[#7CA8FF] border border-[#0052FF]/35">
                        <Rocket className="w-3 h-3" strokeWidth={1.6} />
                        Curve
                      </span>
                    )}
                    {token.mode === 'GRADUATED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-micro bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30">
                        <CheckCircle2 className="w-3 h-3" strokeWidth={1.6} />
                        v4 Live
                      </span>
                    )}
                    {token.mode === 'INSTANT' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-micro bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30">
                        <Flame className="w-3 h-3" strokeWidth={1.6} />
                        Instant v4
                      </span>
                    )}
                  </div>
                </div>

                {token.mode === 'CURVE' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Uniswap v4 Graduation Progress</span>
                      <span className="font-mono font-semibold text-[#00E599]">{progress}%</span>
                    </div>
                    <div className="w-full bg-[#080B10] rounded-full h-2 overflow-hidden border border-white/[0.07]">
                      <div
                        className="bg-gradient-to-r from-[#0052FF] to-[#00E599] h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-mono text-muted tabular-nums">
                    <span>Reserves: </span>
                    <span className="text-ink font-semibold">
                      {token.b20Reserve.toFixed(2)} {token.pairedStockSymbol} (${marketCapUsd})
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <a
                      href={`${explorerUrl}/token/${token.tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-muted hover:text-white font-mono"
                    >
                      <span>BaseScan</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
                    </a>
                    <Link
                      href={`/?pair=${token.tokenAddress}`}
                      className="flex items-center space-x-1 text-[#00E599] hover:text-white font-semibold"
                    >
                      <span>Trade</span>
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </Link>
                  </div>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
