'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  Pause,
  Wallet,
  Layers,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useProtocol, TokenPair } from '../context/ProtocolContext';

function SwapContent() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const searchParams = useSearchParams();

  const {
    isMainnet,
    isSepolia,
    isMainnetPaused,
    stockBalances,
    tokenBalances,
    communityTokens,
    executeApproval,
    executeSwap,
    setIsFaucetOpen,
  } = useProtocol();

  // Active pair selection
  const requestedPair = searchParams.get('pair');
  const [activeToken, setActiveToken] = useState<TokenPair>(() => {
    if (requestedPair) {
      const match = communityTokens.find(
        (t) => t.symbol.toUpperCase() === requestedPair.toUpperCase()
      );
      if (match) return match;
    }
    return communityTokens[0];
  });

  // Keep activeToken in sync if communityTokens updates
  useEffect(() => {
    if (requestedPair) {
      const match = communityTokens.find(
        (t) => t.symbol.toUpperCase() === requestedPair.toUpperCase()
      );
      if (match) {
        setActiveToken(match);
        return;
      }
    }
    const currentStillExists = communityTokens.find((t) => t.symbol === activeToken.symbol);
    if (!currentStillExists && communityTokens.length > 0) {
      setActiveToken(communityTokens[0]);
    } else if (currentStillExists) {
      setActiveToken(currentStillExists);
    }
  }, [communityTokens, requestedPair]);

  const activeStock =
    VERIFIED_B20_STOCKS.find((s) => s.symbol === activeToken.pairedStockSymbol) ||
    VERIFIED_B20_STOCKS[0];

  const [activeTab, setActiveTab] = useState<'SWAP' | 'LIQUIDITY'>('SWAP');
  const [fromAmount, setFromAmount] = useState('1');
  const [isTokenToStock, setIsTokenToStock] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [customSlippage, setCustomSlippage] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Execution states
  const [txState, setTxState] = useState<'IDLE' | 'APPROVING' | 'SWAPPING' | 'CONFIRMED'>('IDLE');
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mockMultiplier = 1.0; // 1 Token = 1 Share
  const parsedFrom = parseFloat(fromAmount) || 0;
  const effectiveSlippage = customSlippage ? parseFloat(customSlippage) || 0.5 : parseFloat(slippage);

  // Balances
  const stockBalance = stockBalances[activeStock.symbol] || 0;
  const tokenBalance = tokenBalances[activeToken.symbol] || 0;
  const userPayingBalance = isTokenToStock ? tokenBalance : stockBalance;
  const userReceivingBalance = isTokenToStock ? stockBalance : tokenBalance;

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
  const priceImpact =
    activeToken.b20Reserve > 0
      ? Math.min(25.0, (tradeSizeInB20 / (activeToken.b20Reserve + tradeSizeInB20)) * 100).toFixed(2)
      : '0.10';

  const numericPriceImpact = parseFloat(priceImpact);

  // Fees
  const creatorFeePercent = activeToken.creatorFeeBps / 100;
  const poolFeePercent = 0.3; // 0.30% Uniswap v4 standard
  const treasuryFeePercent = isSepolia ? 0.10 : 0.0; // Hard-capped at 0.10% (10 bps) for testnet only
  const estimatedFeeB20 = ((tradeSizeInB20 * (creatorFeePercent + poolFeePercent + treasuryFeePercent)) / 100).toFixed(4);

  // Token USD equivalent
  const tokenPriceUsd = (activeToken.stockPriceUsd / activeToken.ratePerStock).toFixed(6);

  const handleMaxClick = () => {
    if (userPayingBalance > 0) {
      setFromAmount(userPayingBalance.toString());
    }
  };

  const handleSwap = async () => {
    if (parsedFrom <= 0 || parsedFrom > userPayingBalance) return;
    setErrorMessage(null);

    try {
      setTxState('APPROVING');
      await executeApproval(isTokenToStock ? activeToken.symbol : activeStock.symbol, parsedFrom);

      setTxState('SWAPPING');
      const hash = await executeSwap({
        fromSymbol: isTokenToStock ? activeToken.symbol : activeStock.symbol,
        toSymbol: isTokenToStock ? activeStock.symbol : activeToken.symbol,
        fromAmount: parsedFrom,
        toAmount: rawToAmount,
        tokenSymbol: activeToken.symbol,
        isTokenToStock,
      });

      setLastTxHash(hash);
      setTxState('CONFIRMED');
      setTimeout(() => setTxState('IDLE'), 8000);
    } catch (err: any) {
      console.error('Swap failed:', err);
      setErrorMessage(err?.message || 'Transaction was rejected or failed.');
      setTxState('IDLE');
    }
  };

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
              {communityTokens.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => setActiveToken(token)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
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
                  <div className="flex items-center space-x-1.5">
                    <span>
                      Balance: {userPayingBalance.toLocaleString(undefined, { maximumFractionDigits: isTokenToStock ? 0 : 3 })}{' '}
                      {isTokenToStock ? activeToken.symbol : activeStock.symbol}
                    </span>
                    {userPayingBalance > 0 && (
                      <button
                        onClick={handleMaxClick}
                        className="text-[10px] bg-primary/20 hover:bg-primary/30 text-primary px-1.5 py-0.5 rounded font-bold"
                      >
                        MAX
                      </button>
                    )}
                    {!isTokenToStock && isSepolia && (
                      <button
                        onClick={() => setIsFaucetOpen(true)}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold underline"
                      >
                        +Faucet
                      </button>
                    )}
                  </div>
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
                  <span>
                    Balance: {userReceivingBalance.toLocaleString(undefined, { maximumFractionDigits: isTokenToStock ? 3 : 0 })}{' '}
                    {isTokenToStock ? activeStock.symbol : activeToken.symbol}
                  </span>
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
                    {creatorFeePercent}% Creator + {poolFeePercent}% v4 LP
                    {isSepolia && ' + 0.10% Treasury'} (~{estimatedFeeB20} {activeStock.symbol})
                  </span>
                </div>

                {isSepolia && (
                  <div className="flex justify-between items-center text-gray-400 pt-1 border-t border-border/40">
                    <span className="text-[11px] flex items-center gap-1 text-gray-400">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      Testnet Treasury Fee (0.10% Cap)
                    </span>
                    <a
                      href="https://sepolia.basescan.org/address/0xc96147c68ca8e153e70B3bC4745b8d974bDd212A"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1"
                      title="Testnet Treasury Address: 0xc96147c68ca8e153e70B3bC4745b8d974bDd212A"
                    >
                      <span>0xc961...212A</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Transaction Confirmed Card */}
              {txState === 'CONFIRMED' && lastTxHash && (
                <div className="p-3 bg-green-950/40 border border-green-800 rounded-xl text-xs text-green-300 flex items-center justify-between animate-fadeIn">
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

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-xs text-red-300 flex items-center space-x-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
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
                ) : isMainnet && isMainnetPaused ? (
                  <button
                    onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                    className="w-full py-3.5 bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700 text-amber-200 rounded-xl font-bold transition-all text-xs flex items-center justify-center space-x-2"
                  >
                    <Pause className="w-4 h-4 text-amber-400" />
                    <span>Mainnet Paused — Switch to Base Sepolia Testnet</span>
                  </button>
                ) : parsedFrom > userPayingBalance ? (
                  <div className="space-y-2">
                    <button
                      disabled
                      className="w-full py-3.5 bg-surface-hover border border-border text-gray-500 rounded-xl font-bold cursor-not-allowed text-xs"
                    >
                      Insufficient {isTokenToStock ? activeToken.symbol : activeStock.symbol} Balance
                    </button>
                    {!isTokenToStock && isSepolia && (
                      <button
                        onClick={() => setIsFaucetOpen(true)}
                        className="w-full py-2 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-300 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5"
                      >
                        <Droplets className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Claim Free {activeStock.symbol} from Faucet</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    disabled={parsedFrom <= 0 || txState !== 'IDLE'}
                    onClick={handleSwap}
                    className="w-full py-3.5 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:text-gray-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 text-xs"
                  >
                    {txState === 'APPROVING' && (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Confirming Approval in Wallet...</span>
                      </>
                    )}
                    {txState === 'SWAPPING' && (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Confirming Swap in Wallet...</span>
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

      {/* Protocol Features & Ecosystem Hub */}
      <div className="pt-8 border-t border-border/80 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>🐂</span>
              <span>All bulldot.xyz Features</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Everything you need: token launchpad, liquidity pool explorer, and creator equity fee management.
            </p>
          </div>
          <Link
            href="/launch"
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Launch a New Token</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Token Launchpad */}
          <Link
            href="/launch"
            className="p-5 bg-surface border border-border hover:border-primary/60 rounded-2xl transition-all group shadow-md hover:shadow-primary/5 space-y-3 block"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <Rocket className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800">
                Launchpad
              </span>
            </div>
            <div>
              <h3 className="font-bold text-white text-base group-hover:text-primary transition-colors flex items-center gap-1.5">
                <span>Token Launchpad</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Launch community tokens with Fair Launch Bonding Curves (0 capital needed) or Instant Uniswap v4 pools with 100% liquidity locked forever to 0x...dEaD.
              </p>
            </div>
            <div className="text-xs font-semibold text-primary pt-1 flex items-center gap-1">
              <span>Deploy Token Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Card 2: Explore Pools */}
          <Link
            href="/explore"
            className="p-5 bg-surface border border-border hover:border-primary/60 rounded-2xl transition-all group shadow-md hover:shadow-primary/5 space-y-3 block"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                Explore Pools
              </span>
            </div>
            <div>
              <h3 className="font-bold text-white text-base group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                <span>Explore Pools & Curves</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Browse verified community tokens paired with bCOIN, bNVDA, bAAPL, and bTSLA. Track bonding curve graduation progress in real time.
              </p>
            </div>
            <div className="text-xs font-semibold text-emerald-400 pt-1 flex items-center gap-1">
              <span>View All Pools</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Card 3: Creator Hub & Treasury */}
          <Link
            href="/dashboard"
            className="p-5 bg-surface border border-border hover:border-primary/60 rounded-2xl transition-all group shadow-md hover:shadow-primary/5 space-y-3 block"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800">
                Creator Hub
              </span>
            </div>
            <div>
              <h3 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                <span>Creator & Treasury Hub</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Track raw and canonical share earnings, claim fee rewards, or redirect fees to Coinbase stock treasuries for automated buybacks and burns.
              </p>
            </div>
            <div className="text-xs font-semibold text-amber-400 pt-1 flex items-center gap-1">
              <span>Manage Fees & Claims</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">Loading exchange...</div>}>
      <SwapContent />
    </Suspense>
  );
}
