'use client';

import React, { useState } from 'react';
import { VERIFIED_B20_STOCKS, B20StockMetadata } from '../config/stocks';
import { PriceChart } from '../components/PriceChart';
import { LiquidityViewer } from '../components/LiquidityViewer';
import {
  ArrowDownUp,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Settings,
  ExternalLink,
  RefreshCw,
  Droplets,
  ArrowRightLeft,
  Flame,
  Rocket,
  Info,
} from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';

interface TokenPair {
  name: string;
  symbol: string;
  pairedStockSymbol: string;
  isGraduated: boolean;
  ratePerStock: number;
  stockPriceUsd: number;
  b20Reserve: number;
  tokenReserve: number;
  creatorFeeBps: number;
}

const SUPPORTED_COMMUNITY_TOKENS: TokenPair[] = [
  {
    name: 'Bull Protocol',
    symbol: 'BULL',
    pairedStockSymbol: 'bCOIN',
    isGraduated: true,
    ratePerStock: 142857, // 1 bCOIN = 142,857 BULL
    stockPriceUsd: 312.50,
    b20Reserve: 50.00,
    tokenReserve: 329375000,
    creatorFeeBps: 100, // 1.0%
  },
  {
    name: 'Nvidia Meme Moon',
    symbol: 'NVMOON',
    pairedStockSymbol: 'bNVDA',
    isGraduated: true,
    ratePerStock: 70323,
    stockPriceUsd: 142.20,
    b20Reserve: 50.00,
    tokenReserve: 329375000,
    creatorFeeBps: 150,
  },
  {
    name: 'Apple Autonomous',
    symbol: 'APPL',
    pairedStockSymbol: 'bAAPL',
    isGraduated: true,
    ratePerStock: 44280,
    stockPriceUsd: 225.80,
    b20Reserve: 25.00,
    tokenReserve: 1000000000,
    creatorFeeBps: 100,
  },
  {
    name: 'Tesla Cybertruck Club',
    symbol: 'CYBR',
    pairedStockSymbol: 'bTSLA',
    isGraduated: false, // Bonding curve
    ratePerStock: 277777,
    stockPriceUsd: 215.00,
    b20Reserve: 16.00,
    tokenReserve: 550000000,
    creatorFeeBps: 200,
  },
];

export default function SwapPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();

  // Active pair selection
  const [activeToken, setActiveToken] = useState<TokenPair>(SUPPORTED_COMMUNITY_TOKENS[0]);
  const activeStock = VERIFIED_B20_STOCKS.find((s) => s.symbol === activeToken.pairedStockSymbol) || VERIFIED_B20_STOCKS[0];

  const [activeTab, setActiveTab] = useState<'SWAP' | 'LIQUIDITY'>('SWAP');
  const [fromAmount, setFromAmount] = useState('1');
  const [isTokenToStock, setIsTokenToStock] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [customSlippage, setCustomSlippage] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Execution states
  const [txState, setTxState] = useState<'IDLE' | 'APPROVING' | 'SWAPPING' | 'CONFIRMED'>('IDLE');
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const mockMultiplier = 1.0; // 1 Token = 1 Share
  const parsedFrom = parseFloat(fromAmount) || 0;
  const effectiveSlippage = customSlippage ? parseFloat(customSlippage) || 0.5 : parseFloat(slippage);

  // Quote calculations
  const rawToAmount = isTokenToStock
    ? parsedFrom / activeToken.ratePerStock
    : parsedFrom * activeToken.ratePerStock;

  const formattedToAmount = isTokenToStock
    ? rawToAmount.toFixed(6)
    : Math.floor(rawToAmount).toLocaleString();

  const minReceived = (rawToAmount * (1 - effectiveSlippage / 100)).toLocaleString(undefined, {
    maximumFractionDigits: isTokenToStock ? 6 : 0,
  });

  // Price impact calculation based on trade size relative to pool depth
  const tradeSizeInB20 = isTokenToStock ? rawToAmount : parsedFrom;
  const priceImpact = activeToken.b20Reserve > 0
    ? Math.min(25.0, ((tradeSizeInB20 / (activeToken.b20Reserve + tradeSizeInB20)) * 100)).toFixed(2)
    : '0.10';

  const numericPriceImpact = parseFloat(priceImpact);

  // Fees
  const creatorFeePercent = activeToken.creatorFeeBps / 100;
  const poolFeePercent = 0.30; // 0.30% Uniswap v4 standard
  const estimatedFeeB20 = (tradeSizeInB20 * (creatorFeePercent + poolFeePercent) / 100).toFixed(4);

  // Token USD equivalent
  const tokenPriceUsd = (activeToken.stockPriceUsd / activeToken.ratePerStock).toFixed(6);

  const handleSwap = () => {
    if (parsedFrom <= 0) return;
    setTxState('APPROVING');

    setTimeout(() => {
      setTxState('SWAPPING');
      setTimeout(() => {
        setTxState('CONFIRMED');
        setLastTxHash('0x3a9f8b2c1e4d7a6e5b8c9d0f1e2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a');
        setTimeout(() => setTxState('IDLE'), 6000);
      }, 1500);
    }, 1200);
  };

  const isSepolia = chainId === 84532;
  const explorerUrl = isSepolia ? 'https://sepolia.basescan.org' : 'https://basescan.org';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Headline */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Decentralized Exchange on Base
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Instant swaps backed by Coinbase Tokenized Equities and permanent Uniswap v4 liquidity.
        </p>
      </div>

      {/* Main Grid: Price Chart (Left/Top) & Swap Box (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Price History Chart */}
        <div className="lg:col-span-7 space-y-4">
          <PriceChart
            tokenSymbol={activeToken.symbol}
            stockSymbol={activeStock.symbol}
            stockPriceUsd={activeToken.stockPriceUsd}
            multiplier={mockMultiplier}
          />

          {/* Quick Token Selector Pills */}
          <div className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Select Community Token:</span>
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              {SUPPORTED_COMMUNITY_TOKENS.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => setActiveToken(token)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeToken.symbol === token.symbol
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-background text-gray-400 hover:text-white border border-border'
                  }`}
                >
                  ${token.symbol}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Trading & Liquidity Container */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card Mode Tabs: Swap vs Liquidity Depth */}
          <div className="flex bg-surface border border-border rounded-xl p-1 text-xs">
            <button
              onClick={() => setActiveTab('SWAP')}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'SWAP'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Instant Swap</span>
            </button>

            <button
              onClick={() => setActiveTab('LIQUIDITY')}
              className={`flex-1 py-2 rounded-lg font-semibold transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'LIQUIDITY'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              <span>Pool Liquidity</span>
            </button>
          </div>

          {activeTab === 'SWAP' ? (
            /* Swap Card */
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-xl space-y-4">
              {/* Header: Status & Settings */}
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center space-x-1.5">
                  {activeToken.isGraduated ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-950/60 text-green-300 border border-green-800">
                      <Flame className="w-3 h-3" />
                      Uniswap v4 Native
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/60 text-blue-300 border border-blue-800">
                      <Rocket className="w-3 h-3" />
                      Bonding Curve Active
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-background"
                  title="Slippage settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{effectiveSlippage}% Slippage</span>
                </button>
              </div>

              {/* Slippage Settings Drawer */}
              {showSettings && (
                <div className="p-3 bg-background border border-border rounded-xl space-y-2 text-xs">
                  <span className="font-semibold text-gray-300 block">Slippage Tolerance Protection</span>
                  <div className="flex items-center space-x-2">
                    {['0.1', '0.5', '1.0'].map((val) => (
                      <button
                        key={val}
                        onClick={() => {
                          setSlippage(val);
                          setCustomSlippage('');
                        }}
                        className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                          slippage === val && !customSlippage
                            ? 'bg-primary text-white border-primary'
                            : 'bg-surface text-gray-400 border-border hover:text-white'
                        }`}
                      >
                        {val}%
                      </button>
                    ))}

                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        placeholder="Custom"
                        value={customSlippage}
                        onChange={(e) => setCustomSlippage(e.target.value)}
                        className="w-16 px-2 py-1 bg-surface border border-border rounded-lg text-white text-xs focus:outline-none focus:border-primary"
                      />
                      <span className="text-gray-400">%</span>
                    </div>
                  </div>
                  {effectiveSlippage > 3 && (
                    <p className="text-[11px] text-warning flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      High slippage increases risk of MEV sandwich attacks.
                    </p>
                  )}
                </div>
              )}

              {/* From Box */}
              <div className="bg-background border border-border/80 rounded-xl p-3.5">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1.5">
                  <span>You Pay</span>
                  <span>Balance: 12.450 {isTokenToStock ? activeToken.symbol : activeStock.symbol}</span>
                </div>

                <div className="flex items-center justify-between">
                  <input
                    type="number"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    placeholder="0.0"
                    className="bg-transparent text-2xl font-semibold text-white focus:outline-none w-3/5"
                  />

                  {!isTokenToStock ? (
                    <div className="flex items-center space-x-1.5 bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-white font-medium text-xs">
                      <span className="font-bold">{activeStock.symbol}</span>
                      <span className="text-[10px] text-gray-400">({activeStock.ticker})</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-white font-medium text-xs">
                      <span>🐂</span>
                      <span>${activeToken.symbol}</span>
                    </div>
                  )}
                </div>

                {/* Subtext USD */}
                <div className="mt-2 text-[11px] text-gray-500 flex justify-between">
                  <span>
                    {!isTokenToStock
                      ? `~$${(parsedFrom * activeToken.stockPriceUsd).toFixed(2)} USD`
                      : `~$${(parsedFrom * parseFloat(tokenPriceUsd)).toFixed(2)} USD`}
                  </span>
                  <span className="text-gray-400">
                    1 {activeStock.symbol} = ${activeToken.stockPriceUsd.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Invert Direction Button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  onClick={() => setIsTokenToStock(!isTokenToStock)}
                  className="bg-surface border border-border hover:border-primary p-2 rounded-xl text-gray-400 hover:text-white transition-all shadow-md"
                  title="Switch swap direction"
                >
                  <ArrowDownUp className="w-4 h-4" />
                </button>
              </div>

              {/* To Box */}
              <div className="bg-background border border-border/80 rounded-xl p-3.5 mt-1">
                <div className="flex justify-between items-center text-xs text-gray-400 mb-1.5">
                  <span>You Receive (Estimated)</span>
                  <span>Balance: 0.00</span>
                </div>

                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    readOnly
                    value={formattedToAmount}
                    placeholder="0.0"
                    className="bg-transparent text-2xl font-semibold text-white focus:outline-none w-3/5 cursor-default"
                  />

                  {isTokenToStock ? (
                    <div className="flex items-center space-x-1.5 bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-white font-medium text-xs">
                      <span className="font-bold">{activeStock.symbol}</span>
                      <span className="text-[10px] text-gray-400">({activeStock.ticker})</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5 bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-white font-medium text-xs">
                      <span>🐂</span>
                      <span>${activeToken.symbol}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 text-[11px] text-gray-500">
                  <span>Guaranteed Minimum ({effectiveSlippage}% max slippage): {minReceived}</span>
                </div>
              </div>

              {/* Clear Pricing, Impact, and Fee Breakdown */}
              <div className="p-3 bg-background/50 border border-border/60 rounded-xl space-y-2 text-xs">
                {/* Dual price reference */}
                <div className="flex justify-between text-gray-400">
                  <span>Dual Price</span>
                  <div className="text-right text-gray-200">
                    <span className="block font-medium">1 ${activeToken.symbol} ≈ ${tokenPriceUsd} USD</span>
                    <span className="text-[10px] text-gray-400">
                      (1 {activeStock.symbol} ≈ {activeToken.ratePerStock.toLocaleString()} {activeToken.symbol})
                    </span>
                  </div>
                </div>

                {/* Price Impact with clear color coding */}
                <div className="flex justify-between text-gray-400 items-center">
                  <span>Price Impact</span>
                  <span
                    className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                      numericPriceImpact > 3
                        ? 'bg-red-950/60 text-danger border border-red-800'
                        : numericPriceImpact > 1
                        ? 'bg-amber-950/60 text-warning border border-amber-800'
                        : 'bg-green-950/60 text-success border border-green-800'
                    }`}
                  >
                    {priceImpact}% {numericPriceImpact > 3 ? '(High)' : ''}
                  </span>
                </div>

                {/* B20 Multiplier Info */}
                <div className="flex justify-between text-gray-400">
                  <span>B20 Stock Multiplier</span>
                  <span className="text-gray-200 flex items-center gap-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    1.00x (1 Token = 1.00 Share)
                  </span>
                </div>

                {/* Transparent Fee Info */}
                <div className="flex justify-between text-gray-400">
                  <span>Trading Fees</span>
                  <span className="text-gray-200 text-[11px]">
                    {creatorFeePercent}% Creator + {poolFeePercent}% v4 LP (~{estimatedFeeB20} {activeStock.symbol})
                  </span>
                </div>
              </div>

              {/* Transaction Confirmed Card */}
              {txState === 'CONFIRMED' && lastTxHash && (
                <div className="p-3 bg-green-950/40 border border-green-800 rounded-xl text-xs text-green-300 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span>Swap confirmed on Base!</span>
                  </div>
                  <a
                    href={`${explorerUrl}/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 underline hover:text-white"
                  >
                    <span>View Tx</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Action Button */}
              <div>
                {!isConnected ? (
                  <button
                    disabled
                    className="w-full py-3.5 bg-surface-hover border border-border text-gray-400 rounded-xl font-medium cursor-not-allowed text-xs"
                  >
                    Connect Wallet to Trade
                  </button>
                ) : (
                  <button
                    disabled={parsedFrom <= 0 || txState !== 'IDLE'}
                    onClick={handleSwap}
                    className="w-full py-3.5 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:text-gray-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 text-xs"
                  >
                    {txState === 'APPROVING' && (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Approving {isTokenToStock ? activeToken.symbol : activeStock.symbol}...</span>
                      </>
                    )}
                    {txState === 'SWAPPING' && (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Executing Swap on Uniswap v4...</span>
                      </>
                    )}
                    {txState === 'IDLE' && <span>Swap {activeStock.symbol} / ${activeToken.symbol}</span>}
                    {txState === 'CONFIRMED' && <span>Trade Succeeded!</span>}
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Liquidity Viewer Component */
            <LiquidityViewer
              tokenSymbol={activeToken.symbol}
              stockSymbol={activeStock.symbol}
              stockPriceUsd={activeToken.stockPriceUsd}
              multiplier={mockMultiplier}
              isGraduated={activeToken.isGraduated}
              b20Reserve={activeToken.b20Reserve}
              tokenReserve={activeToken.tokenReserve}
            />
          )}
        </div>
      </div>
    </div>
  );
}
