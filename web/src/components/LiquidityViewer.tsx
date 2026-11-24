'use client';

import React from 'react';
import { ShieldCheck, Flame, ExternalLink, Lock, Droplets, Layers, CheckCircle2 } from 'lucide-react';
import { useChainId } from 'wagmi';

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
  const totalTvlUsd = b20ValueUsd * 2; // In 50/50 Uniswap pool, TVL = 2x paired asset

  const underlyingShares = (b20Reserve / multiplier).toFixed(2);
  const deadAddress = '0x000000000000000000000000000000000000dEaD';

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Droplets className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-white text-base">Pool Reserves & Liquidity Depth</h2>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-950/60 text-green-300 border border-green-800">
          <Lock className="w-3.5 h-3.5" />
          100% Permanently Locked
        </span>
      </div>

      {/* Primary TVL Metric */}
      <div className="p-4 bg-background border border-border/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs text-gray-400 block mb-0.5">Total Value Locked (TVL)</span>
          <div className="text-2xl font-extrabold text-white">
            ${totalTvlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
          <span className="text-xs text-primary font-medium">
            Backed by {b20Reserve.toFixed(2)} {stockSymbol} ({underlyingShares} Canonical Equity Shares)
          </span>
        </div>

        <div className="text-right">
          <span className="text-xs text-gray-400 block mb-0.5">Pool Structure</span>
          <span className="text-sm font-semibold text-gray-200 block">
            {isGraduated ? 'Uniswap v4 Native Pool' : 'Bonding Curve (Pre-Migration)'}
          </span>
          <span className="text-xs text-gray-400">
            {isGraduated
              ? '0.30% Fee Tier • Tick 60'
              : `Graduation: ${sharesAccumulated.toFixed(2)} / ${targetShares} shares`}
          </span>
        </div>
      </div>

      {/* Dual Token Reserves Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Box 1: Paired B20 Stock */}
        <div className="p-3.5 bg-background/50 border border-border rounded-xl space-y-1">
          <span className="text-gray-400 block font-medium">Pooled {stockSymbol} (Coinbase Equity)</span>
          <div className="text-lg font-bold text-white">
            {b20Reserve.toLocaleString()} {stockSymbol}
          </div>
          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-border/60">
            <span>USD Value:</span>
            <span className="text-gray-200 font-semibold">${b20ValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Box 2: Meme Token Reserve */}
        <div className="p-3.5 bg-background/50 border border-border rounded-xl space-y-1">
          <span className="text-gray-400 block font-medium">Pooled ${tokenSymbol}</span>
          <div className="text-lg font-bold text-white">
            {tokenReserve.toLocaleString()} {tokenSymbol}
          </div>
          <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1 border-t border-border/60">
            <span>Share of Total Supply:</span>
            <span className="text-gray-200 font-semibold">{((tokenReserve / 1_000_000_000) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Security & Verification Callout */}
      <div className="p-3.5 bg-blue-950/20 border border-blue-900/40 rounded-xl text-xs space-y-2">
        <div className="flex items-center space-x-2 text-blue-300 font-semibold">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Autonomous Zero-Touch Verification</span>
        </div>
        <p className="text-blue-300/80 text-[11px] leading-relaxed">
          100% of the Uniswap v4 liquidity position is burned to the Dead address. There is no multisig, no admin key, and no emergency withdrawal function. The pool cannot be rug-pulled.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
          {curveAddress && curveAddress !== '0x0000000000000000000000000000000000000000' && (
            <a
              href={`${explorerUrl}/address/${curveAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-primary hover:text-white underline"
            >
              <span>Inspect Bonding Curve</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {tokenAddress && (
            <a
              href={`${explorerUrl}/token/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-primary hover:text-white underline"
            >
              <span>Inspect Token Contract</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <a
            href={`${explorerUrl}/address/${deadAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-gray-300 hover:text-white underline"
          >
            <span>Burn Address (0x...dEaD)</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <a
            href={`${explorerUrl}/address/${poolManagerAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 text-gray-400 hover:text-white underline"
          >
            <span>Uniswap v4 PoolManager</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

