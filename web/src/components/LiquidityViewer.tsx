'use client';

import React from 'react';
import { ShieldCheck, ExternalLink, Lock, Droplets } from 'lucide-react';
import { useChainId } from 'wagmi';
import { SpotlightCard } from './MotionPrimitives';

interface LiquidityViewerProps {
  tokenSymbol: string;
  stockSymbol: string;
  stockPriceUsd: number;
  multiplier: number;
  isGraduated: boolean;
  b20Reserve: number;
  tokenReserve: number;
  sharesAccumulated?: number;
  targetShares?: number;
  tokenAddress?: string;
  curveAddress?: string;
  poolManagerAddress?: string;
}

export function LiquidityViewer({
  tokenSymbol,
  stockSymbol,
  stockPriceUsd,
  multiplier,
  isGraduated,
  b20Reserve,
  tokenReserve,
  sharesAccumulated = 0,
  targetShares = 50,
  tokenAddress,
  curveAddress,
  poolManagerAddress = '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408',
}: LiquidityViewerProps) {
  const chainId = useChainId();
  const isSepolia = chainId === 84532;
  const explorerUrl = isSepolia ? 'https://sepolia.basescan.org' : 'https://basescan.org';

  const b20ValueUsd = b20Reserve * stockPriceUsd;
  const totalTvlUsd = b20ValueUsd * 2;
  const underlyingShares = (b20Reserve / multiplier).toFixed(2);
  const deadAddress = '0x000000000000000000000000000000000000dEaD';

  return (
    <SpotlightCard className="p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Droplets className="w-4 h-4 text-[#00E599]" strokeWidth={1.6} />
          <h2 className="font-display font-semibold text-white text-base tracking-tight">
            Pool Reserves &amp; Depth
          </h2>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-micro bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30">
          <Lock className="w-3 h-3" strokeWidth={1.75} />
          100% Locked
        </span>
      </div>

      {/* TVL & Structure */}
      <div className="p-4 bg-[#080B10] border border-white/[0.07] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-micro text-muted block mb-1">
            Total Value Locked
          </span>
          <div className="font-mono text-2xl font-semibold text-white tabular-nums">
            ${totalTvlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-xs text-[#00E599] font-mono">
            {b20Reserve.toFixed(2)} {stockSymbol} ({underlyingShares} Canonical Shares)
          </span>
        </div>

        <div className="sm:text-right">
          <span className="text-[10px] uppercase tracking-micro text-muted block mb-1">
            Architecture
          </span>
          <span className="text-sm font-medium text-ink block">
            {isGraduated ? 'Uniswap v4 Pool' : 'Bonding Curve AMM'}
          </span>
          <span className="font-mono text-[11px] text-muted">
            {isGraduated
              ? '0.30% Fee Tier • Tick 60'
              : `${sharesAccumulated.toFixed(2)} / ${targetShares} shares to v4`}
          </span>
        </div>
      </div>

      {/* Reserves Split */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 bg-[#080B10]/70 border border-white/[0.07] rounded-xl space-y-1.5">
          <span className="text-muted block">Pooled {stockSymbol} Equity</span>
          <div className="font-mono text-base font-semibold text-white tabular-nums">
            {b20Reserve.toLocaleString(undefined, { maximumFractionDigits: 4 })} {stockSymbol}
          </div>
          <div className="text-[11px] text-muted flex items-center justify-between pt-1.5 border-t border-white/[0.06]">
            <span>Est. USD</span>
            <span className="font-mono text-ink tabular-nums">
              ${b20ValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-[#080B10]/70 border border-white/[0.07] rounded-xl space-y-1.5">
          <span className="text-muted block">Pooled ${tokenSymbol}</span>
          <div className="font-mono text-base font-semibold text-white tabular-nums">
            {Math.floor(tokenReserve).toLocaleString()} {tokenSymbol}
          </div>
          <div className="text-[11px] text-muted flex items-center justify-between pt-1.5 border-t border-white/[0.06]">
            <span>Supply Share</span>
            <span className="font-mono text-ink tabular-nums">
              {((tokenReserve / 1_000_000_000) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* On-Chain Verification Links */}
      <div className="p-3.5 bg-[#0052FF]/[0.07] border border-[#0052FF]/25 rounded-xl text-xs space-y-2">
        <div className="flex items-center space-x-2 text-ink font-medium">
          <ShieldCheck className="w-4 h-4 text-[#00E599]" strokeWidth={1.6} />
          <span>Immutable Liquidity Invariant</span>
        </div>
        <p className="text-muted text-[11px] leading-relaxed">
          Uniswap v4 LP tokens are permanently minted to <span className="font-mono text-ink">0x...dEaD</span> with zero withdrawal or upgrade hooks.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono">
          {curveAddress && curveAddress !== '0x0000000000000000000000000000000000000000' && (
            <a
              href={`${explorerUrl}/address/${curveAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-[#7CA8FF] hover:text-white underline"
            >
              <span>Bonding Curve</span>
              <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
            </a>
          )}

          {tokenAddress && (
            <a
              href={`${explorerUrl}/token/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-[#00E599] hover:text-white underline"
            >
              <span>Token Contract</span>
              <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
            </a>
          )}

          <a
            href={`${explorerUrl}/address/${deadAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-muted hover:text-white underline"
          >
            <span>Burn Address</span>
            <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
          </a>

          <a
            href={`${explorerUrl}/address/${poolManagerAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-muted hover:text-white underline"
          >
            <span>v4 PoolManager</span>
            <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
          </a>
        </div>
      </div>
    </SpotlightCard>
  );
}
