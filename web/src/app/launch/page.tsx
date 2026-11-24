'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { VERIFIED_B20_STOCKS } from '../../config/stocks';
import {
  ShieldCheck,
  Rocket,
  Flame,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Info,
  ExternalLink,
  Pause,
  Droplets,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useProtocol, TokenPair } from '../../context/ProtocolContext';

export default function LaunchPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const {
    isMainnet,
    isSepolia,
    isMainnetPaused,
    stockBalances,
    executeLaunch,
    setIsFaucetOpen,
  } = useProtocol();

  const explorerUrl = isSepolia ? 'https://sepolia.basescan.org' : 'https://basescan.org';

  const [mode, setMode] = useState<'CURVE' | 'INSTANT'>('CURVE');
  const [selectedStock, setSelectedStock] = useState(VERIFIED_B20_STOCKS[0]);
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [creatorFee, setCreatorFee] = useState(1.0);
  const [feeDestination, setFeeDestination] = useState<'CREATOR' | 'STOCK_TREASURY' | 'CUSTOM'>('CREATOR');
  const [customRecipient, setCustomRecipient] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('5');
  const [antiDumpMode, setAntiDumpMode] = useState<'2%' | '1%' | 'OFF'>('2%');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deployedTx, setDeployedTx] = useState<string | null>(null);
  const [deployedToken, setDeployedToken] = useState<TokenPair | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userStockBalance = stockBalances[selectedStock.symbol] || 0;
  const parsedDeposit = parseFloat(initialDeposit) || 0;
  const hasEnoughDeposit = mode !== 'INSTANT' || userStockBalance >= parsedDeposit;

  const handleLaunch = async () => {
    if (!tokenName || !tokenSymbol) return;
    if (mode === 'INSTANT' && !hasEnoughDeposit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await executeLaunch({
        name: tokenName,
        symbol: tokenSymbol,
        stockSymbol: selectedStock.symbol,
        mode,
        initialDeposit: mode === 'INSTANT' ? parsedDeposit : 0,
        creatorFeeBps: Math.round(creatorFee * 100),
        antiDumpMode,
        feeDestination,
        customRecipient: feeDestination === 'CUSTOM' ? customRecipient : undefined,
      });

      setDeployedTx(result.txHash);
      setDeployedToken(result.token);
    } catch (err: any) {
      console.error('Launch failed:', err);
      setErrorMessage(err?.message || 'Transaction was rejected or failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Launch a Token on Base</h1>
        <p className="text-gray-400 mt-2 text-sm">
          Paired exclusively with verified Coinbase tokenized equities. Completely autonomous, fair, and permanent.
        </p>
      </div>

      {/* Deployment Success Card */}
      {deployedTx && deployedToken && (
        <div className="p-5 bg-green-950/40 border border-green-800 rounded-2xl text-xs text-green-300 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-green-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5" />
              Token Successfully Deployed!
            </span>
            <a
              href={`${explorerUrl}/tx/${deployedTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 underline hover:text-white"
            >
              <span>View on BaseScan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="text-green-300/80 leading-relaxed">
            <strong>${deployedToken.symbol}</strong> ({deployedToken.name}) is deployed on Base Sepolia via BulldotFactory and paired with{' '}
            <strong>{deployedToken.pairedStockSymbol}</strong>. Official verification badge (`isOfficialLaunch`) granted on-chain.
          </p>

          {deployedToken.tokenAddress !== '0x0000000000000000000000000000000000000000' && (
            <div className="text-[11px] font-mono text-green-200/90 flex items-center gap-2">
              <span>Token Contract:</span>
              <a
                href={`${explorerUrl}/token/${deployedToken.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white flex items-center gap-1"
              >
                <span>{deployedToken.tokenAddress}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          <div className="pt-2 flex items-center space-x-3">
            <Link
              href={`/?pair=${deployedToken.tokenAddress !== '0x0000000000000000000000000000000000000000' ? deployedToken.tokenAddress : deployedToken.symbol}`}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold flex items-center space-x-1.5 transition-all shadow-md"
            >
              <span>Trade ${deployedToken.symbol} Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explore"
              className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-gray-300 rounded-xl font-semibold transition-all"
            >
              <span>View in Explore Pools</span>
            </Link>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 bg-red-950/40 border border-red-800 rounded-xl text-xs text-red-300 flex items-center space-x-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Step 1: Launch Mode Selection */}
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
                Zero capital needed upfront. Community trades along an AMM curve until 50 canonical equity shares are accumulated, then migrates automatically to Uniswap v4.
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
                For creators with capital. Seeds a permanent Uniswap v4 pool immediately. 100% of liquidity is minted to 0x...dEaD forever.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Pairing Asset Selection */}
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
                  <div className="mt-1 text-[10px] text-primary flex items-center justify-center gap-1 font-semibold">
                    <ShieldCheck className="w-3 h-3" />
                    Verified B20
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 3: Token Metadata */}
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
          <div className="p-4 bg-background border border-warning/30 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-warning flex items-center gap-1.5">
                <Flame className="w-4 h-4" />
                Initial {selectedStock.symbol} Liquidity Deposit
              </span>
              <div className="flex items-center space-x-1.5 text-xs text-gray-400">
                <span>Balance: {userStockBalance.toFixed(2)} {selectedStock.symbol}</span>
                {isSepolia && (
                  <button
                    onClick={() => setIsFaucetOpen(true)}
                    className="text-emerald-400 underline hover:text-emerald-300 font-semibold"
                  >
                    +Faucet
                  </button>
                )}
              </div>
            </div>

            <input
              type="number"
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value)}
              placeholder="e.g. 5"
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
            />

            {!hasEnoughDeposit && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Insufficient {selectedStock.symbol} balance. Claim more from the Stock Faucet above.
              </p>
            )}

            <p className="text-xs text-gray-400">
              This {selectedStock.symbol} will be paired with 1,000,000,000 newly minted {tokenSymbol || 'tokens'} in Uniswap v4 and permanently burned to 0x...dEaD.
            </p>
          </div>
        )}

        {/* Step 4: Optional Anti-Sniper Fair Launch Limit (Bonding Curve Only) */}
        {mode === 'CURVE' && (
          <div className="p-4 bg-background/70 border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-white">Anti-Sniper Fair Launch Cap</span>
              </div>
              <span className="text-[11px] text-gray-400">Curve Phase Only</span>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Restricts any single wallet from cornering the supply during early curve trading. Deactivates automatically upon graduation to Uniswap v4.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => setAntiDumpMode('2%')}
                className={`py-2 rounded-lg border font-semibold transition-all ${
                  antiDumpMode === '2%'
                    ? 'border-primary bg-primary/10 text-white'
                    : 'border-border bg-surface text-gray-400 hover:text-white'
                }`}
              >
                2% Max Wallet (Rec.)
              </button>
              <button
                type="button"
                onClick={() => setAntiDumpMode('1%')}
                className={`py-2 rounded-lg border font-semibold transition-all ${
                  antiDumpMode === '1%'
                    ? 'border-primary bg-primary/10 text-white'
                    : 'border-border bg-surface text-gray-400 hover:text-white'
                }`}
              >
                1% Max (Strict)
              </button>
              <button
                type="button"
                onClick={() => setAntiDumpMode('OFF')}
                className={`py-2 rounded-lg border font-semibold transition-all ${
                  antiDumpMode === 'OFF'
                    ? 'border-primary bg-primary/10 text-white'
                    : 'border-border bg-surface text-gray-400 hover:text-white'
                }`}
              >
                Disabled (Unlimited)
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Creator Fee & Redirection */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-200">
              Step 5: Creator Fee ({creatorFee}%)
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
            <span className="text-xs text-gray-400 block font-medium">Fee Destination Routing:</span>
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

        {/* Security & Verification Callout */}
        <div className="p-3.5 bg-blue-950/20 border border-blue-900/40 rounded-xl text-xs text-blue-300 space-y-1">
          <div className="flex items-center gap-1 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Official Factory Launch Guarantee
          </div>
          <p className="text-blue-300/80 text-[11px] leading-relaxed">
            Every token launched receives cryptographic verification (`isOfficialLaunch`). Total supply is capped at 1B with no minting or burning functions. 100% of liquidity is burned permanently to 0x...dEaD.
          </p>
        </div>

        {/* Launch Button */}
        <div>
          {!isConnected ? (
            <button
              disabled
              className="w-full py-4 bg-surface-hover border border-border text-gray-400 rounded-xl font-medium cursor-not-allowed text-xs"
            >
              Connect Wallet to Deploy
            </button>
          ) : isMainnet && isMainnetPaused ? (
            <button
              onClick={() => switchChain?.({ chainId: baseSepolia.id })}
              className="w-full py-4 bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700 text-amber-200 rounded-xl font-bold transition-all text-xs flex items-center justify-center space-x-2"
            >
              <Pause className="w-4 h-4 text-amber-400" />
              <span>Mainnet Paused — Switch to Base Sepolia Testnet</span>
            </button>
          ) : mode === 'INSTANT' && !hasEnoughDeposit ? (
            <button
              disabled
              className="w-full py-4 bg-surface-hover border border-border text-gray-500 rounded-xl font-bold cursor-not-allowed text-xs"
            >
              Insufficient {selectedStock.symbol} Balance for Deposit
            </button>
          ) : (
            <button
              disabled={isSubmitting || !tokenName || !tokenSymbol}
              onClick={handleLaunch}
              className="w-full py-4 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:text-gray-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/25 text-xs flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Confirming Deployment in Wallet...</span>
                </>
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
