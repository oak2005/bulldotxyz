'use client';

import React, { useState } from 'react';
import { VERIFIED_B20_STOCKS } from '../../config/stocks';
import { ShieldCheck, Rocket, Flame, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAccount } from 'wagmi';

export default function LaunchPage() {
  const { isConnected, address } = useAccount();

  const [mode, setMode] = useState<'CURVE' | 'INSTANT'>('CURVE');
  const [selectedStock, setSelectedStock] = useState(VERIFIED_B20_STOCKS[0]);
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [creatorFee, setCreatorFee] = useState(1.0);
  const [feeDestination, setFeeDestination] = useState<'CREATOR' | 'STOCK_TREASURY' | 'CUSTOM'>('CREATOR');
  const [customRecipient, setCustomRecipient] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('5');
  const [antiDumpEnabled, setAntiDumpEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLaunch = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      alert(
        `Token ${tokenSymbol || '$BULL'} successfully deployed!\nMode: ${
          mode === 'CURVE' ? 'Bonding Curve (Auto-migrating)' : 'Instant Uniswap v4 Pool (Locked Forever)'
        }\nPair: ${selectedStock.symbol}\nCreator Fee: ${creatorFee}%`
      );
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Launch a Token on Base</h1>
        <p className="text-gray-400 mt-2 text-sm">
          Paired exclusively with verified Coinbase tokenized equities. Completely autonomous and permanent.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Launch Mode Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-3">
            Step 1: Choose Your Launch Path
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mode 2: Bonding Curve */}
            <div
              onClick={() => setMode('CURVE')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                mode === 'CURVE'
                  ? 'border-primary bg-primary/10 shadow-md'
                  : 'border-border bg-background/60 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center space-x-2 text-primary font-bold text-base mb-1">
                <Rocket className="w-5 h-5" />
                <span>Fair Launch Curve</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Zero capital needed upfront. Community trades along a mathematical curve until 50 shares target is met, then automatically migrates to Uniswap v4.
              </p>
            </div>

            {/* Mode 1: Instant Pool */}
            <div
              onClick={() => setMode('INSTANT')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                mode === 'INSTANT'
                  ? 'border-primary bg-primary/10 shadow-md'
                  : 'border-border bg-background/60 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center space-x-2 text-warning font-bold text-base mb-1">
                <Flame className="w-5 h-5" />
                <span>Instant Uniswap v4</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                For creators with capital. Seeds a permanent Uniswap v4 pool immediately. Liquidity is permanently burned to 0xDead forever.
              </p>
            </div>
          </div>
        </div>

        {/* Pairing Asset Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">
            Step 2: Select Pairing Stock Asset (Coinbase B20 Standard)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {VERIFIED_B20_STOCKS.map((stock) => {
              const selected = selectedStock.symbol === stock.symbol;
              return (
                <div
                  key={stock.symbol}
                  onClick={() => setSelectedStock(stock)}
                  className={`p-3 rounded-xl border cursor-pointer text-center transition-all ${
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background/40 hover:border-gray-700'
                  }`}
                >
                  <div className="font-bold text-white text-sm">{stock.symbol}</div>
                  <div className="text-[11px] text-gray-400">{stock.name}</div>
                  <div className="mt-1 text-[10px] text-primary flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Verified B20
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Token Metadata */}
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">
            Step 3: Token Details
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-400 block mb-1">Token Name</span>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. Bull Moon"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <span className="text-xs text-gray-400 block mb-1">Ticker / Symbol</span>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. BULL"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Instant Pool Seed Amount (Conditional) */}
        {mode === 'INSTANT' && (
          <div className="p-4 bg-background border border-warning/30 rounded-xl space-y-2">
            <span className="text-sm font-semibold text-warning flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              Initial {selectedStock.symbol} Deposit Required
            </span>
            <input
              type="number"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value)}
              placeholder="e.g. 10"
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
            />
            <p className="text-xs text-gray-400">
              This {selectedStock.symbol} will be paired with 1,000,000,000 newly minted {tokenSymbol || 'tokens'} and permanently locked to 0xDead.
            </p>
          </div>
        )}

        {/* Creator Fee & Redirection */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-200">
              Step 4: Creator Fee ({creatorFee}%)
            </label>
            <span className="text-xs text-gray-400">Hard limit: 2.5% max</span>
          </div>

          <input
            type="range"
            min="0"
            max="2.5"
            step="0.1"
            value={creatorFee}
            onChange={(e) => setCreatorFee(parseFloat(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />

          {/* Fee Redirection Options */}
          <div className="mt-2 space-y-2">
            <span className="text-xs text-gray-400 block">Fee Recipient Destination:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFeeDestination('CREATOR')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  feeDestination === 'CREATOR'
                    ? 'border-primary bg-primary/10 text-white font-medium'
                    : 'border-border bg-background/40 text-gray-400 hover:text-white'
                }`}
              >
                My Connected Wallet
              </button>

              <button
                type="button"
                onClick={() => setFeeDestination('STOCK_TREASURY')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  feeDestination === 'STOCK_TREASURY'
                    ? 'border-primary bg-primary/10 text-white font-medium'
                    : 'border-border bg-background/40 text-gray-400 hover:text-white'
                }`}
              >
                Stock Treasury (Buy & Burn)
              </button>

              <button
                type="button"
                onClick={() => setFeeDestination('CUSTOM')}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  feeDestination === 'CUSTOM'
                    ? 'border-primary bg-primary/10 text-white font-medium'
                    : 'border-border bg-background/40 text-gray-400 hover:text-white'
                }`}
              >
                Custom DAO / Split
              </button>
            </div>

            {feeDestination === 'CUSTOM' && (
              <input
                type="text"
                value={customRecipient}
                onChange={(e) => setCustomRecipient(e.target.value)}
                placeholder="0x... Recipient Address"
                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
              />
            )}
          </div>
        </div>

        {/* Anti-Dump Option */}
        <div className="p-3 bg-background/60 border border-border rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <div>
              <span className="text-xs font-semibold text-white block">Anti-Sniper Fair Launch Limit</span>
              <span className="text-[11px] text-gray-400 block">Restricts single wallets to max 2% of curve supply to prevent frontrunning.</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={antiDumpEnabled}
            onChange={(e) => setAntiDumpEnabled(e.target.checked)}
            className="w-4 h-4 accent-primary rounded cursor-pointer"
          />
        </div>

        {/* Security Confirmation Notice */}
        <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl text-xs text-blue-300 space-y-1">
          <div className="flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Immutable Deployment Guarantee
          </div>
          <p className="text-blue-300/80">
            Total supply is permanently capped at 1,000,000,000 tokens. No admin keys, no upgrade proxies, and all pool liquidity will be burned irrevocably.
          </p>
        </div>

        {/* Launch Button */}
        <div>
          {!isConnected ? (
            <button
              disabled
              className="w-full py-4 bg-surface-hover border border-border text-gray-400 rounded-xl font-medium cursor-not-allowed text-sm"
            >
              Connect Wallet to Deploy
            </button>
          ) : (
            <button
              disabled={isSubmitting || !tokenName || !tokenSymbol}
              onClick={handleLaunch}
              className="w-full py-4 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:text-gray-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/25 text-sm flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <span>Deploying to Base Sepolia...</span>
              ) : (
                <span>Launch {tokenSymbol ? `$${tokenSymbol}` : 'Token'} Now</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

