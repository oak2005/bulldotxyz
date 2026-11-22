'use client';

import React, { useState } from 'react';
import { VERIFIED_B20_STOCKS } from '../config/stocks';
import { ArrowDownUp, AlertCircle, ShieldCheck, CheckCircle2, Settings, ExternalLink, RefreshCw } from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';

export default function SwapPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();

  const [fromAsset, setFromAsset] = useState(VERIFIED_B20_STOCKS[0]); // bCOIN default
  const [fromAmount, setFromAmount] = useState('1');
  const [isTokenToStock, setIsTokenToStock] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [customSlippage, setCustomSlippage] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Transaction execution state
  const [txState, setTxState] = useState<'IDLE' | 'APPROVING' | 'SWAPPING' | 'CONFIRMED'>('IDLE');
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Simulated live prices & multiplier metrics
  const mockStockPriceUsd = fromAsset.symbol === 'bCOIN' ? 312.50 : fromAsset.symbol === 'bNVDA' ? 142.20 : 225.80;
  const mockMultiplier = 1.0; // 1 token = 1 share
  const tokenRatePerStock = 142857; // e.g. 1 bCOIN = 142,857 BULL

  const parsedFrom = parseFloat(fromAmount) || 0;
  const effectiveSlippage = customSlippage ? parseFloat(customSlippage) || 0.5 : parseFloat(slippage);

  const rawToAmount = isTokenToStock 
    ? (parsedFrom / tokenRatePerStock)
    : (parsedFrom * tokenRatePerStock);

  const formattedToAmount = isTokenToStock
    ? rawToAmount.toFixed(6)
    : Math.floor(rawToAmount).toLocaleString();

  const minReceived = (rawToAmount * (1 - effectiveSlippage / 100)).toLocaleString(undefined, {
    maximumFractionDigits: isTokenToStock ? 6 : 0,
  });

  const priceImpact = parsedFrom > 10 ? 1.4 : 0.08;

  const handleSwap = () => {
    if (parsedFrom <= 0) return;
    setTxState('APPROVING');

    setTimeout(() => {
      setTxState('SWAPPING');
      setTimeout(() => {
        setTxState('CONFIRMED');
        setLastTxHash('0x3a9f8b2c1e4d7a6e5b8c9d0f1e2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a');
        setTimeout(() => setTxState('IDLE'), 5000);
      }, 1500);
    }, 1200);
  };

  const isSepolia = chainId === 84532;
  const explorerUrl = isSepolia ? 'https://sepolia.basescan.org' : 'https://basescan.org';

  return (
    <div className="max-w-lg mx-auto">
      {/* Page Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Trade Against Tokenized Stocks</h1>
        <p className="text-sm text-gray-400 mt-1">
          Zero friction swapping backed by permanent Uniswap v4 liquidity on Base.
        </p>
      </div>

      {/* Main Swap Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl">
        {/* Card Header: Settings Toggle */}
        <div className="flex justify-between items-center mb-4 text-xs">
          <div className="flex items-center space-x-1.5 text-gray-300">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="font-medium">Direct Uniswap v4 Routing</span>
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-background/80"
            title="Slippage Settings"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{effectiveSlippage}% Slippage</span>
          </button>
        </div>

        {/* Slippage Settings Drawer */}
        {showSettings && (
          <div className="mb-4 p-3 bg-background border border-border rounded-xl space-y-2 text-xs">
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
        <div className="bg-background border border-border/80 rounded-xl p-4">
          <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
            <span>You Pay</span>
            <span>Balance: 12.450 {isTokenToStock ? 'BULL' : fromAsset.symbol}</span>
          </div>

          <div className="flex items-center justify-between">
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-2xl font-semibold text-white focus:outline-none w-2/3"
            />

            {!isTokenToStock ? (
              <select
                value={fromAsset.symbol}
                onChange={(e) => {
                  const selected = VERIFIED_B20_STOCKS.find((s) => s.symbol === e.target.value);
                  if (selected) setFromAsset(selected);
                }}
                className="bg-surface-hover border border-border text-white text-sm font-medium rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
              >
                {VERIFIED_B20_STOCKS.map((stock) => (
                  <option key={stock.symbol} value={stock.symbol}>
                    {stock.symbol} ({stock.ticker})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center space-x-1.5 bg-surface-hover border border-border rounded-lg px-3 py-2 text-white font-medium text-sm">
                <span>🐂</span>
                <span>$BULL</span>
              </div>
            )}
          </div>

          {/* Dual price reference */}
          <div className="mt-2 text-xs text-gray-500 flex justify-between">
            <span>
              {!isTokenToStock
                ? `~$${(parsedFrom * mockStockPriceUsd).toFixed(2)} USD`
                : `~$${(parseFloat(formattedToAmount.replace(/,/g, '')) * mockStockPriceUsd || 0).toFixed(2)} USD`}
            </span>
            <span className="text-gray-400">
              1 {fromAsset.symbol} = ${mockStockPriceUsd.toFixed(2)} ({mockMultiplier}x Split Ratio)
            </span>
          </div>
        </div>

        {/* Switch Direction Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={() => setIsTokenToStock(!isTokenToStock)}
            className="bg-surface border border-border hover:border-primary p-2 rounded-xl text-gray-400 hover:text-white transition-all shadow-md"
            title="Switch direction"
          >
            <ArrowDownUp className="w-4 h-4" />
          </button>
        </div>

        {/* To Box */}
        <div className="bg-background border border-border/80 rounded-xl p-4 mt-1">
          <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
            <span>You Receive (Estimated)</span>
            <span>Balance: 0.00</span>
          </div>

          <div className="flex items-center justify-between">
            <input
              type="text"
              readOnly
              value={formattedToAmount}
              placeholder="0.0"
              className="bg-transparent text-2xl font-semibold text-white focus:outline-none w-2/3 cursor-default"
            />

            {isTokenToStock ? (
              <select
                value={fromAsset.symbol}
                onChange={(e) => {
                  const selected = VERIFIED_B20_STOCKS.find((s) => s.symbol === e.target.value);
                  if (selected) setFromAsset(selected);
                }}
                className="bg-surface-hover border border-border text-white text-sm font-medium rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
              >
                {VERIFIED_B20_STOCKS.map((stock) => (
                  <option key={stock.symbol} value={stock.symbol}>
                    {stock.symbol} ({stock.ticker})
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center space-x-1.5 bg-surface-hover border border-border rounded-lg px-3 py-2 text-white font-medium text-sm">
                <span>🐂</span>
                <span>$BULL</span>
              </div>
            )}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            <span>Guaranteed Minimum ({effectiveSlippage}% max slippage): {minReceived}</span>
          </div>
        </div>

        {/* Pricing & Multiplier Breakdown */}
        <div className="mt-4 p-3 bg-background/50 border border-border/60 rounded-xl space-y-2 text-xs">
          <div className="flex justify-between text-gray-400">
            <span>Rate</span>
            <span className="text-gray-200">1 {fromAsset.symbol} ≈ {tokenRatePerStock.toLocaleString()} BULL</span>
          </div>

          <div className="flex justify-between text-gray-400">
            <span>Price Impact</span>
            <span className={priceImpact > 1 ? 'text-warning font-medium' : 'text-success font-medium'}>
              {priceImpact}%
            </span>
          </div>

          <div className="flex justify-between text-gray-400">
            <span>B20 Stock Multiplier</span>
            <span className="text-gray-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              1.00x (1 Token = 1.00 Share)
            </span>
          </div>

          <div className="flex justify-between text-gray-400">
            <span>Creator Fee (1.0%)</span>
            <span className="text-gray-200">0.01 {fromAsset.symbol} (Redirectable)</span>
          </div>
        </div>

        {/* Transaction Confirmation Card */}
        {txState === 'CONFIRMED' && lastTxHash && (
          <div className="mt-4 p-3 bg-green-950/40 border border-green-800 rounded-xl text-xs text-green-300 flex items-center justify-between">
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
        <div className="mt-5">
          {!isConnected ? (
            <button
              disabled
              className="w-full py-3.5 bg-surface-hover border border-border text-gray-400 rounded-xl font-medium cursor-not-allowed text-sm"
            >
              Connect Wallet to Swap
            </button>
          ) : (
            <button
              disabled={parsedFrom <= 0 || txState !== 'IDLE'}
              onClick={handleSwap}
              className="w-full py-3.5 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:text-gray-500 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 text-sm"
            >
              {txState === 'APPROVING' && (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Approving {fromAsset.symbol}...</span>
                </>
              )}
              {txState === 'SWAPPING' && (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing Swap on Uniswap v4...</span>
                </>
              )}
              {txState === 'IDLE' && <span>Swap Now</span>}
              {txState === 'CONFIRMED' && <span>Trade Completed!</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
