'use client';

import React, { useState } from 'react';
import { VERIFIED_B20_STOCKS } from '../config/stocks';
import { ArrowDownUp, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAccount, useChainId } from 'wagmi';

export default function SwapPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  const [fromAsset, setFromAsset] = useState(VERIFIED_B20_STOCKS[0]); // bCOIN default
  const [fromAmount, setFromAmount] = useState('1');
  const [isTokenToStock, setIsTokenToStock] = useState(false);
  const [slippage, setSlippage] = useState('0.5');

  // Simulated live prices & multiplier metrics
  const mockStockPriceUsd = fromAsset.symbol === 'bCOIN' ? 312.50 : fromAsset.symbol === 'bNVDA' ? 142.20 : 225.80;
  const mockMultiplier = 1.0; // 1 token = 1 share
  const tokenRatePerStock = 142857; // e.g. 1 bCOIN = 142,857 BULL

  const parsedFrom = parseFloat(fromAmount) || 0;
  const toAmount = isTokenToStock 
    ? (parsedFrom / tokenRatePerStock).toFixed(6) 
    : (parsedFrom * tokenRatePerStock).toLocaleString();

  const priceImpact = parsedFrom > 10 ? 1.4 : 0.08;

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
                : `~$${(parseFloat(toAmount) * mockStockPriceUsd || 0).toFixed(2)} USD`}
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
              value={toAmount}
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
            <span>Minimum received with {slippage}% slippage: {(parseFloat(toAmount.replace(/,/g, '')) * (1 - parseFloat(slippage)/100)).toLocaleString()}</span>
          </div>
        </div>

        {/* Pricing & Fee Breakdown */}
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

        {/* Action Button */}
        <div className="mt-5">
          {!isConnected ? (
            <button
              disabled
              className="w-full py-3.5 bg-surface-hover border border-border text-gray-400 rounded-xl font-medium cursor-not-allowed"
            >
              Connect Wallet to Swap
            </button>
          ) : (
            <button
              onClick={() => alert('Swap transaction submitted to Uniswap v4 on Base Sepolia!')}
              className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold transition-colors shadow-lg shadow-primary/20 flex items-center justify-center space-x-2"
            >
              <span>Swap Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

