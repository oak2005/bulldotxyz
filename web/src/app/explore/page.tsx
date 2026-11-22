'use client';

import React, { useState } from 'react';
import { VERIFIED_B20_STOCKS } from '../../config/stocks';
import { ShieldCheck, Flame, Rocket, ExternalLink, ArrowRight, CheckCircle2, Lock, Droplets } from 'lucide-react';
import Link from 'next/link';

interface LaunchedTokenItem {
  name: string;
  symbol: string;
  pairStock: string;
  mode: 'CURVE' | 'GRADUATED' | 'INSTANT';
  progress: number;
  marketCapB20: string;
  creatorFee: number;
  isVerified: boolean;
  isTreasuryAligned: boolean;
}

const MOCK_TOKENS: LaunchedTokenItem[] = [
  {
    name: 'Bull Protocol',
    symbol: 'BULL',
    pairStock: 'bCOIN',
    mode: 'GRADUATED',
    progress: 100,
    marketCapB20: '50.0 bCOIN (~$15,625)',
    creatorFee: 1.0,
    isVerified: true,
    isTreasuryAligned: true,
  },
  {
    name: 'Nvidia Meme Moon',
    symbol: 'NVMOON',
    pairStock: 'bNVDA',
    mode: 'GRADUATED',
    progress: 100,
    marketCapB20: '50.0 bNVDA (~$7,110)',
    creatorFee: 1.5,
    isVerified: true,
    isTreasuryAligned: true,
  },
  {
    name: 'Apple Autonomous',
    symbol: 'APPL',
    pairStock: 'bAAPL',
    mode: 'INSTANT',
    progress: 100,
    marketCapB20: '25.0 bAAPL (~$5,645)',
    creatorFee: 1.0,
    isVerified: true,
    isTreasuryAligned: false,
  },
  {
    name: 'Tesla Cybertruck Club',
    symbol: 'CYBR',
    pairStock: 'bTSLA',
    mode: 'CURVE',
    progress: 32,
    marketCapB20: '16.0 bTSLA (~$3,440)',
    creatorFee: 2.0,
    isVerified: true,
    isTreasuryAligned: false,
  },
  {
    name: 'Treasury Share Token',
    symbol: 'TST',
    pairStock: 'bCOIN',
    mode: 'INSTANT',
    progress: 100,
    marketCapB20: '20.0 bCOIN (~$6,250)',
    creatorFee: 2.0,
    isVerified: true,
    isTreasuryAligned: true,
  },
];

export default function ExplorePage() {
  const [filterStock, setFilterStock] = useState('ALL');
  const [filterMode, setFilterMode] = useState<'ALL' | 'V4' | 'CURVE'>('ALL');

  const filtered = MOCK_TOKENS.filter((t) => {
    const stockMatch = filterStock === 'ALL' || t.pairStock === filterStock;
    const modeMatch =
      filterMode === 'ALL' ||
      (filterMode === 'V4' && (t.mode === 'GRADUATED' || t.mode === 'INSTANT')) ||
      (filterMode === 'CURVE' && t.mode === 'CURVE');
    return stockMatch && modeMatch;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Explore Token Pools</h1>
          <p className="text-sm text-gray-400 mt-1">
            Authentic community tokens launched exclusively against Coinbase B20 tokenized stocks.
          </p>
        </div>

        {/* Mode Filter Pills */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filterMode === 'ALL'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface text-gray-400 border-border hover:text-white'
            }`}
          >
            All Pools
          </button>
          <button
            onClick={() => setFilterMode('V4')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filterMode === 'V4'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface text-gray-400 border-border hover:text-white'
            }`}
          >
            Uniswap v4 Live
          </button>
          <button
            onClick={() => setFilterMode('CURVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filterMode === 'CURVE'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-surface text-gray-400 border-border hover:text-white'
            }`}
          >
            Active Curves
          </button>
        </div>
      </div>

      {/* Stock Filter Pills */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        <span className="text-gray-400 font-medium">Filter by Equity:</span>
        <button
          onClick={() => setFilterStock('ALL')}
          className={`px-2.5 py-1 rounded-lg border transition-colors font-medium ${
            filterStock === 'ALL'
              ? 'bg-primary text-white border-primary'
              : 'bg-surface text-gray-400 border-border hover:text-white'
          }`}
        >
          All Stocks
        </button>
        {VERIFIED_B20_STOCKS.map((s) => (
          <button
            key={s.symbol}
            onClick={() => setFilterStock(s.symbol)}
            className={`px-2.5 py-1 rounded-lg border transition-colors font-medium ${
              filterStock === s.symbol
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-gray-400 border-border hover:text-white'
            }`}
          >
            {s.symbol}
          </button>
        ))}
      </div>

      {/* Grid of Tokens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((token) => (
          <div
            key={token.symbol}
            className="bg-surface border border-border rounded-xl p-5 hover:border-gray-700 transition-all shadow-md space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center text-xl">
                  🐂
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-white text-base">{token.name}</span>
                    <span className="text-xs text-gray-400 font-mono">${token.symbol}</span>
                    {token.isVerified && (
                      <span
                        className="inline-flex items-center gap-0.5 text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-primary/30"
                        title="Official Bulldot Factory Launch with permanent liquidity lock"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                    <span>Paired with <strong className="text-gray-200">{token.pairStock}</strong></span>
                    {token.isTreasuryAligned && (
                      <span className="text-[10px] text-green-400 font-medium">
                        • Stock Treasury Aligned
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-right">
                {token.mode === 'CURVE' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-950/60 text-blue-300 border border-blue-800/60">
                    <Rocket className="w-3 h-3" />
                    Bonding Curve
                  </span>
                )}
                {token.mode === 'GRADUATED' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-green-950/60 text-green-300 border border-green-800/60">
                    <CheckCircle2 className="w-3 h-3" />
                    Uniswap v4 Live
                  </span>
                )}
                {token.mode === 'INSTANT' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60">
                    <Flame className="w-3 h-3" />
                    Instant v4 Lock
                  </span>
                )}
              </div>
            </div>

            {/* Bonding Curve Progress Bar */}
            {token.mode === 'CURVE' && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Uniswap v4 Graduation Progress</span>
                  <span className="font-semibold text-primary">{token.progress}%</span>
                </div>
                <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-border/60">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${token.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Metrics Footer */}
            <div className="pt-2 border-t border-border/80 flex items-center justify-between text-xs text-gray-400">
              <div>
                <span>Reserves: </span>
                <span className="text-gray-200 font-medium">{token.marketCapB20}</span>
              </div>

              <div className="flex items-center space-x-3">
                <Link
                  href={`/?pair=${token.symbol}`}
                  className="flex items-center space-x-1 text-primary hover:text-primary-hover font-semibold"
                >
                  <span>Trade</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
