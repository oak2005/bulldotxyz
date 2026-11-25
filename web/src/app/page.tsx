'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { VERIFIED_B20_STOCKS } from '../config/stocks';
import { CONTRACT_CONFIGS } from '../config/contracts';
import { PriceChart } from '../components/PriceChart';
import { LiquidityViewer } from '../components/LiquidityViewer';
import { OnboardingGuide } from '../components/OnboardingGuide';
import {
  BaseNetworkMark,
  UniswapMark,
  StockEquityBadge,
  TokenEmblem,
} from '../components/BrandAssets';
import {
  SpotlightCard,
  TactileButton,
  TactileLink,
  Reveal,
  snappySpring,
} from '../components/MotionPrimitives';
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
  BookOpen,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { zeroAddress } from 'viem';
import { useProtocol, TokenPair, SwapQuoteResult } from '../context/ProtocolContext';

function SwapContent() {
  const { isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const searchParams = useSearchParams();

  const {
    isMainnet,
    isSepolia,
    isMainnetPaused,
    isLoadingPools,
    ethBalance,
    ethStockPoolReady,
    stockBalances,
    tokenBalances,
    communityTokens,
    getSwapQuote,
    executeApproval,
    executeSwap,
    setIsFaucetOpen,
  } = useProtocol();

  const requestedPair = searchParams.get('pair');
  const [activeToken, setActiveToken] = useState<TokenPair | null>(null);

  useEffect(() => {
    if (requestedPair && communityTokens.length > 0) {
      const match = communityTokens.find(
        (t) =>
          t.tokenAddress.toLowerCase() === requestedPair.toLowerCase() ||
          t.symbol.toUpperCase() === requestedPair.toUpperCase()
      );
      if (match) {
        setActiveToken(match);
        return;
      }
    }
    if (activeToken) {
      const currentStillExists = communityTokens.find(
        (t) => t.tokenAddress.toLowerCase() === activeToken.tokenAddress.toLowerCase()
      );
      if (currentStillExists) {
        setActiveToken(currentStillExists);
      } else if (communityTokens.length > 0) {
        setActiveToken(communityTokens[0]);
      } else {
        setActiveToken(null);
      }
    } else if (communityTokens.length > 0) {
      setActiveToken(communityTokens[0]);
    }
  }, [communityTokens, requestedPair]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeStock =
    (activeToken && VERIFIED_B20_STOCKS.find((s) => s.symbol === activeToken.pairedStockSymbol)) ||
    VERIFIED_B20_STOCKS[0];

  const [activeTab, setActiveTab] = useState<'SWAP' | 'LIQUIDITY'>('SWAP');
  const [useEthRoute, setUseEthRoute] = useState<boolean>(true);
  const [fromAmount, setFromAmount] = useState('0.0001');
  const [isTokenToStock, setIsTokenToStock] = useState(false);
  const [slippage, setSlippage] = useState('1.0');
  const [customSlippage, setCustomSlippage] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const [onChainQuote, setOnChainQuote] = useState<SwapQuoteResult | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  const [txState, setTxState] = useState<'IDLE' | 'APPROVING' | 'SWAPPING' | 'CONFIRMED'>('IDLE');
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mockMultiplier = 1.0;
  const parsedFrom = parseFloat(fromAmount) || 0;
  const effectiveSlippage = customSlippage ? parseFloat(customSlippage) || 1.0 : parseFloat(slippage);
  const isEthPoolSeeded = Boolean(ethStockPoolReady[activeStock.symbol]);

  useEffect(() => {
    let cancelled = false;
    if (!activeToken || parsedFrom <= 0) {
      setOnChainQuote(null);
      setIsQuoting(false);
      return;
    }

    setIsQuoting(true);
    const timer = setTimeout(async () => {
      try {
        const res = await getSwapQuote(
          activeToken.tokenAddress,
          activeStock.address[baseSepolia.id],
          fromAmount,
          isTokenToStock,
          useEthRoute
        );
        if (!cancelled) {
          setOnChainQuote(res);
          setIsQuoting(false);
        }
      } catch {
        if (!cancelled) {
          setOnChainQuote(null);
          setIsQuoting(false);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeToken?.tokenAddress, activeToken?.b20Reserve, activeStock.symbol, fromAmount, parsedFrom, isTokenToStock, useEthRoute, isEthPoolSeeded]); // eslint-disable-line react-hooks/exhaustive-deps

  const stockBalance = stockBalances[activeStock.symbol] || 0;
  const tokenBalance = (activeToken && tokenBalances[activeToken.symbol]) || 0;
  const baseAssetBalance = useEthRoute ? ethBalance : stockBalance;
  const baseAssetSymbol = useEthRoute ? 'ETH' : activeStock.symbol;

  const userPayingBalance = isTokenToStock ? tokenBalance : baseAssetBalance;
  const userReceivingBalance = isTokenToStock ? baseAssetBalance : tokenBalance;

  const rate = activeToken?.ratePerStock || 35766667;
  const rawToAmount = onChainQuote ? onChainQuote.amountOut : 0;
  const intermediateStockOut = onChainQuote ? onChainQuote.intermediateStockOut : 0;

  const formattedToAmount = isQuoting
    ? '...'
    : isTokenToStock
    ? rawToAmount.toFixed(6)
    : Math.floor(rawToAmount).toLocaleString();

  const minReceived = (rawToAmount * (1 - effectiveSlippage / 100)).toLocaleString(undefined, {
    maximumFractionDigits: isTokenToStock ? 6 : 0,
  });

  const priceImpact = onChainQuote ? (onChainQuote.priceImpactBps / 100).toFixed(2) : '0.00';
  const numericPriceImpact = parseFloat(priceImpact);

  const creatorFeePercent = (activeToken?.creatorFeeBps || 100) / 100;
  const poolFeePercent = activeToken?.isGraduated || useEthRoute ? 0.3 : 0.0;
  const estimatedFeeB20 = onChainQuote ? onChainQuote.fee.toFixed(6) : '0.0000';

  const exceedsMaxWallet = Boolean(
    !isTokenToStock &&
      activeToken &&
      !activeToken.isGraduated &&
      (activeToken.maxWalletTokens || 0) > 0 &&
      tokenBalance + rawToAmount > (activeToken.maxWalletTokens || 0)
  );

  const stockUsd = activeToken?.stockPriceUsd || activeStock.referencePriceUsd;
  const tokenPriceUsd = rate > 0 ? (stockUsd / rate).toFixed(8) : '0.00000000';

  const handleMaxClick = () => {
    if (userPayingBalance > 0) {
      const safeMax = !isTokenToStock && useEthRoute ? Math.max(0, userPayingBalance - 0.0002) : userPayingBalance;
      setFromAmount(safeMax.toFixed(useEthRoute ? 5 : 4).replace(/\.?0+$/, '') || '0');
    }
  };

  const handleToggleRoute = (nextUseEth: boolean) => {
    setUseEthRoute(nextUseEth);
    setErrorMessage(null);
    if (!isTokenToStock) {
      setFromAmount(nextUseEth ? '0.0001' : '0.1');
    }
  };

  const handleSwap = async () => {
    if (!activeToken || parsedFrom <= 0 || parsedFrom > userPayingBalance || exceedsMaxWallet) return;
    if (useEthRoute && !isEthPoolSeeded) {
      setErrorMessage(`ETH/${activeStock.symbol} Uniswap v4 pool is not seeded yet. Switch to Direct ${activeStock.symbol} or seed the pool.`);
      return;
    }
    setErrorMessage(null);

    try {
      if (isTokenToStock || !useEthRoute) {
        const assetToApprove = isTokenToStock
          ? activeToken.tokenAddress
          : activeStock.address[baseSepolia.id];
        setTxState('APPROVING');
        await executeApproval(assetToApprove, fromAmount);
      } else {
        await executeApproval(zeroAddress, fromAmount);
      }

      const quotedWei = onChainQuote?.amountOutWei || BigInt(0);
      const slippageFactor = BigInt(Math.max(0, Math.round(10_000 - effectiveSlippage * 100)));
      const minAmountOutWei = (quotedWei * slippageFactor) / BigInt(10_000);

      setTxState('SWAPPING');
      const hash = await executeSwap({
        tokenAddress: activeToken.tokenAddress,
        stockAddress: activeStock.address[baseSepolia.id],
        fromAmount,
        minAmountOutWei,
        isTokenToStock,
        useEthRoute,
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
  const sepoliaConfig = CONTRACT_CONFIGS[baseSepolia.id];
  const readyEthPoolsCount = Object.values(ethStockPoolReady).filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* Interactive Onboarding Bar (live state-driven) */}
      <OnboardingGuide />

      {isLoadingPools && communityTokens.length === 0 ? (
        <SpotlightCard outerClassName="max-w-2xl mx-auto" className="p-12 text-center space-y-4">
          <div className="w-8 h-8 border-2 border-[#00E599] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-muted">
            Reading live pools and Uniswap v4 reserves from Base Sepolia...
          </p>
        </SpotlightCard>
      ) : communityTokens.length === 0 ? (
        /* Asymmetric Editorial Hero (60% Left / 40% Right Interactive Card) when 0 Pools deployed */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <Reveal className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 rounded-2xl border border-white/[0.08] bg-[#0E141C]/80 space-y-6">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-micro bg-[#0052FF]/15 text-[#7CA8FF] border border-[#0052FF]/35">
                  <BaseNetworkMark size={12} />
                  <span>Built on Base Sepolia • 84532</span>
                </span>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-micro bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30">
                  <UniswapMark size={12} />
                  <span>Uniswap v4 PoolManager</span>
                </span>
              </div>

              <h1
                className="font-display font-semibold text-white tracking-display leading-[1.04]"
                style={{ fontSize: 'clamp(2.25rem, 1.5rem + 3vw, 3.6rem)' }}
              >
                Equity-backed markets,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5C93FF] via-[#7CA8FF] to-[#00E599]">
                  liquid from block zero.
                </span>
              </h1>

              <p className="text-sm sm:text-base text-muted max-w-xl leading-relaxed">
                Launch fair community tokens paired exclusively with Coinbase B20 tokenized stocks. Buy or sell atomically via Native ETH or B20 shares, with every pool locking permanently in Uniswap v4.
              </p>
            </div>

            <div className="space-y-5 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <TactileLink href="/launch" variant="emerald" className="px-5 py-3 text-xs space-x-2">
                  <Rocket className="w-4 h-4" strokeWidth={1.75} />
                  <span>Launch First Token Pool</span>
                </TactileLink>
                <TactileButton
                  variant="secondary"
                  onClick={() => setIsFaucetOpen(true)}
                  className="px-4 py-3 text-xs space-x-2"
                >
                  <Droplets className="w-4 h-4 text-[#00E599]" strokeWidth={1.6} />
                  <span>Claim Testnet Equities</span>
                </TactileButton>
                <TactileLink href="/docs" variant="secondary" className="px-4 py-3 text-xs space-x-1.5">
                  <BookOpen className="w-4 h-4 text-[#7CA8FF]" strokeWidth={1.6} />
                  <span>Protocol Docs</span>
                </TactileLink>
              </div>

              <div className="pt-4 border-t border-white/[0.07] grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-micro text-muted block">
                    ETH / B20 Pools
                  </span>
                  <span className="font-mono text-sm sm:text-base font-semibold text-[#00E599] tabular-nums mt-0.5 block">
                    {readyEthPoolsCount}/4 Seeded
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-micro text-muted block">
                    Active Curves
                  </span>
                  <span className="font-mono text-sm sm:text-base font-semibold text-white tabular-nums mt-0.5 block">
                    0 (Testnet Live)
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase tracking-micro text-muted block">
                    Treasury Cap
                  </span>
                  <span className="font-mono text-sm sm:text-base font-semibold text-[#7CA8FF] tabular-nums mt-0.5 block">
                    0.10% Max
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right Column (40%): Interactive Live On-Chain Readiness Card */}
          <Reveal delay={0.08} className="lg:col-span-5">
            <SpotlightCard
              accent="emerald"
              outerClassName="h-full"
              className="p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-micro text-[#00E599]">
                    Live Testnet State
                  </span>
                  <span className="inline-flex items-center space-x-1.5 text-[11px] font-mono text-ink">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] animate-pulse" />
                    <span>RPC Connected</span>
                  </span>
                </div>

                <div>
                  <h2 className="font-display text-xl font-semibold text-white tracking-tight">
                    Ready for First On-Chain Launch
                  </h2>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Every deployed curve is readable across all browsers and mobile wallets immediately via <span className="font-mono text-ink">BulldotFactory</span>.
                  </p>
                </div>

                <div className="space-y-2">
                  {VERIFIED_B20_STOCKS.map((stock) => {
                    const ready = ethStockPoolReady[stock.symbol];
                    return (
                      <div
                        key={stock.symbol}
                        className="p-2.5 rounded-xl bg-[#080B10]/80 border border-white/[0.06] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2.5">
                          <StockEquityBadge symbol={stock.symbol} size="sm" />
                          <div>
                            <div className="font-medium text-white">{stock.symbol}</div>
                            <div className="text-[10px] text-muted">{stock.name}</div>
                          </div>
                        </div>
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded-md border ${
                            ready
                              ? 'bg-[#00E599]/10 text-[#00E599] border-[#00E599]/30'
                              : 'bg-white/[0.04] text-muted border-white/[0.08]'
                          }`}
                        >
                          {ready ? 'v4 ETH Ready' : 'Stock Pair'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between text-[11px] font-mono">
                <span className="text-muted">Router Contract</span>
                <a
                  href={`${explorerUrl}/address/${sepoliaConfig.router}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#7CA8FF] hover:text-white flex items-center space-x-1"
                >
                  <span>
                    {sepoliaConfig.router.slice(0, 6)}...{sepoliaConfig.router.slice(-4)}
                  </span>
                  <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
                </a>
              </div>
            </SpotlightCard>
          </Reveal>
        </div>
      ) : activeToken ? (
        /* Live DEX Grid: 7 Cols Chart + Pair Selector / 5 Cols Swap & Liquidity Terminal */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-4">
            <PriceChart
              tokenSymbol={activeToken.symbol}
              stockSymbol={activeStock.symbol}
              stockPriceUsd={activeToken.stockPriceUsd}
              multiplier={mockMultiplier}
              ratePerStock={activeToken.ratePerStock}
              volumeB20={activeToken.volumeB20}
              pricePoints={activeToken.pricePoints}
              isGraduated={activeToken.isGraduated}
            />

            {/* Quick Pair Selector Strip */}
            <div className="bg-[#0E141C] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between gap-3">
              <span className="text-[11px] uppercase tracking-micro text-muted font-medium whitespace-nowrap">
                Active Pairs
              </span>
              <div className="flex items-center space-x-1.5 overflow-x-auto">
                {communityTokens.map((token) => {
                  const selected = activeToken.tokenAddress === token.tokenAddress;
                  return (
                    <button
                      key={token.tokenAddress}
                      onClick={() => setActiveToken(token)}
                      className={`relative px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap ${
                        selected ? 'text-white' : 'text-muted hover:text-ink'
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="pair-selector-pill"
                          transition={snappySpring}
                          className="absolute inset-0 rounded-lg bg-[#0052FF]"
                        />
                      )}
                      <span className="relative z-10">${token.symbol}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Swap & Pool Terminal */}
          <div className="lg:col-span-5 space-y-3">
            {/* Swap vs Liquidity Tabs */}
            <div className="flex bg-[#0E141C] border border-white/[0.08] rounded-xl p-1 text-xs">
              {(['SWAP', 'LIQUIDITY'] as const).map((tab) => {
                const active = activeTab === tab;
                const Icon = tab === 'SWAP' ? ArrowRightLeft : Droplets;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-1.5 ${
                      active ? 'text-white' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="terminal-tab-pill"
                        transition={snappySpring}
                        className="absolute inset-0 rounded-lg bg-[#162030] border border-[#0052FF]/45"
                      />
                    )}
                    <Icon
                      className={`relative z-10 w-3.5 h-3.5 ${
                        active ? 'text-[#00E599]' : 'text-muted'
                      }`}
                      strokeWidth={1.6}
                    />
                    <span className="relative z-10">
                      {tab === 'SWAP' ? 'Instant Swap' : 'Pool Liquidity'}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'SWAP' ? (
              <SpotlightCard className="p-5 space-y-4">
                {/* Card Status + Slippage */}
                <div className="flex justify-between items-center text-xs">
                  <div>
                    {activeToken.isGraduated ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-micro bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30">
                        <Flame className="w-3 h-3" strokeWidth={1.75} />
                        Uniswap v4 Pool
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-micro bg-[#0052FF]/15 text-[#7CA8FF] border border-[#0052FF]/35">
                        <Rocket className="w-3 h-3" strokeWidth={1.75} />
                        Bonding Curve
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center space-x-1.5 text-muted hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04] font-mono text-[11px]"
                  >
                    <Settings className="w-3.5 h-3.5" strokeWidth={1.6} />
                    <span>{effectiveSlippage}%</span>
                  </button>
                </div>

                {/* Settlement Route Toggle (2-Hop ETH vs Direct Stock) */}
                <div className="bg-[#080B10] border border-white/[0.08] rounded-xl p-1 grid grid-cols-2 gap-1 text-[10px] sm:text-[11px]">
                  {[
                    { useEth: true, label: `ETH → ${activeStock.symbol} → Token` },
                    { useEth: false, label: `Direct ${activeStock.symbol}` },
                  ].map((opt) => {
                    const active = useEthRoute === opt.useEth;
                    return (
                      <button
                        key={String(opt.useEth)}
                        type="button"
                        onClick={() => handleToggleRoute(opt.useEth)}
                        className={`relative py-1.5 px-1.5 sm:px-2 rounded-lg font-medium transition-colors truncate ${
                          active ? 'text-white' : 'text-muted hover:text-ink'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="route-mode-pill"
                            transition={snappySpring}
                            className="absolute inset-0 rounded-lg bg-[#0052FF]"
                          />
                        )}
                        <span className="relative z-10 truncate block">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {useEthRoute && !isEthPoolSeeded && (
                  <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-xl text-[11px] text-amber-200 flex items-center justify-between gap-2">
                    <span>ETH/{activeStock.symbol} pool not seeded on current Router.</span>
                    <button
                      type="button"
                      onClick={() => handleToggleRoute(false)}
                      className="underline font-semibold text-amber-300 whitespace-nowrap"
                    >
                      Use {activeStock.symbol}
                    </button>
                  </div>
                )}

                {showSettings && (
                  <div className="p-3 bg-[#080B10] border border-white/[0.08] rounded-xl space-y-2 text-xs">
                    <span className="font-medium text-ink block">Slippage Tolerance</span>
                    <div className="flex items-center space-x-2">
                      {['0.5', '1.0', '2.0'].map((val) => (
                        <button
                          key={val}
                          onClick={() => {
                            setSlippage(val);
                            setCustomSlippage('');
                          }}
                          className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] transition-colors ${
                            slippage === val && !customSlippage
                              ? 'bg-[#0052FF] text-white border-[#0052FF]'
                              : 'bg-[#0E141C] text-muted border-white/[0.08] hover:text-white'
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
                          className="w-16 px-2 py-1 bg-[#0E141C] border border-white/[0.08] rounded-lg text-white font-mono text-xs focus:outline-none focus:border-[#0052FF]"
                        />
                        <span className="text-muted">%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* From Box */}
                <div className="bg-[#080B10] border border-white/[0.08] focus-within:border-[#0052FF]/60 transition-colors rounded-xl p-3.5">
                  <div className="flex justify-between items-center text-xs text-muted mb-1.5">
                    <span>You Pay</span>
                    <div className="flex items-center space-x-2 font-mono text-[11px] tabular-nums">
                      <span>
                        Bal:{' '}
                        {userPayingBalance.toLocaleString(undefined, {
                          maximumFractionDigits: isTokenToStock ? 0 : 4,
                        })}{' '}
                        {isTokenToStock ? activeToken.symbol : baseAssetSymbol}
                      </span>
                      {userPayingBalance > 0 && (
                        <button
                          onClick={handleMaxClick}
                          className="text-[10px] bg-[#0052FF]/20 hover:bg-[#0052FF]/30 text-[#7CA8FF] px-1.5 py-0.5 rounded font-semibold"
                        >
                          MAX
                        </button>
                      )}
                      {!isTokenToStock && !useEthRoute && isSepolia && (
                        <button
                          onClick={() => setIsFaucetOpen(true)}
                          className="text-[10px] text-[#00E599] hover:underline font-semibold"
                        >
                          +Faucet
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="number"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent font-mono text-xl sm:text-2xl font-semibold text-white focus:outline-none flex-1 min-w-0 tabular-nums"
                    />

                    {!isTokenToStock ? (
                      useEthRoute ? (
                        <div className="flex items-center space-x-1.5 bg-[#141C27] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white font-medium text-xs shrink-0">
                          <span className="font-mono font-semibold">ETH</span>
                          <span className="text-[10px] text-[#00E599]">via {activeStock.symbol}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 bg-[#141C27] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white font-medium text-xs shrink-0">
                          <StockEquityBadge symbol={activeStock.symbol} size="sm" />
                          <span>{activeStock.symbol}</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center space-x-2 bg-[#141C27] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white font-medium text-xs shrink-0">
                        <TokenEmblem symbol={activeToken.symbol} size="sm" />
                        <span>${activeToken.symbol}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 font-mono text-[11px] text-muted flex flex-wrap justify-between gap-1 tabular-nums">
                    <span>
                      {!isTokenToStock
                        ? useEthRoute
                          ? `Intermediate: ~${intermediateStockOut.toFixed(4)} ${activeStock.symbol} ($${(intermediateStockOut * stockUsd).toFixed(2)})`
                          : `~$${(parsedFrom * stockUsd).toFixed(2)} USD`
                        : `~$${(parsedFrom * parseFloat(tokenPriceUsd)).toFixed(2)} USD`}
                    </span>
                    <span>
                      1 {activeStock.symbol} = ${stockUsd.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Tactile Swap Direction Flip */}
                <div className="flex justify-center -my-2 relative z-10">
                  <motion.button
                    whileHover={{ rotate: 180 }}
                    whileTap={{ scale: 0.92 }}
                    transition={snappySpring}
                    onClick={() => setIsTokenToStock(!isTokenToStock)}
                    className="bg-[#141C27] border border-white/[0.12] hover:border-[#00E599]/60 p-2 rounded-xl text-ink shadow-md"
                    title="Invert swap direction"
                  >
                    <ArrowDownUp className="w-4 h-4 text-[#00E599]" strokeWidth={1.75} />
                  </motion.button>
                </div>

                {/* To Box */}
                <div className="bg-[#080B10] border border-white/[0.08] rounded-xl p-3.5">
                  <div className="flex justify-between items-center text-xs text-muted mb-1.5">
                    <span>You Receive</span>
                    <span className="font-mono text-[11px] tabular-nums">
                      Bal:{' '}
                      {userReceivingBalance.toLocaleString(undefined, {
                        maximumFractionDigits: isTokenToStock ? 4 : 0,
                      })}{' '}
                      {isTokenToStock ? baseAssetSymbol : activeToken.symbol}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      readOnly
                      value={formattedToAmount}
                      placeholder="0.0"
                      className="bg-transparent font-mono text-xl sm:text-2xl font-semibold text-white focus:outline-none flex-1 min-w-0 cursor-default tabular-nums"
                    />

                    {isTokenToStock ? (
                      useEthRoute ? (
                        <div className="flex items-center space-x-1.5 bg-[#141C27] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white font-medium text-xs shrink-0">
                          <span className="font-mono font-semibold">ETH</span>
                          <span className="text-[10px] text-[#00E599]">via {activeStock.symbol}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 bg-[#141C27] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white font-medium text-xs shrink-0">
                          <StockEquityBadge symbol={activeStock.symbol} size="sm" />
                          <span>{activeStock.symbol}</span>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center space-x-2 bg-[#141C27] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white font-medium text-xs shrink-0">
                        <TokenEmblem symbol={activeToken.symbol} size="sm" />
                        <span>${activeToken.symbol}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 font-mono text-[11px] text-muted flex flex-wrap justify-between gap-1 tabular-nums">
                    <span>
                      Min ({effectiveSlippage}%): {minReceived}{' '}
                      {isTokenToStock ? baseAssetSymbol : activeToken.symbol}
                    </span>
                    {isTokenToStock && useEthRoute && intermediateStockOut > 0 && (
                      <span>Via ~{intermediateStockOut.toFixed(4)} {activeStock.symbol}</span>
                    )}
                  </div>
                </div>

                {/* Breakdown Drawer */}
                <div className="p-3 bg-[#080B10]/70 border border-white/[0.06] rounded-xl space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between gap-1 text-muted">
                    <span>Execution Route</span>
                    <span className="font-mono text-[#00E599] text-[11px]">
                      {useEthRoute
                        ? isTokenToStock
                          ? `$${activeToken.symbol} → ${activeStock.symbol} → ETH`
                          : `ETH → ${activeStock.symbol} → $${activeToken.symbol}`
                        : isTokenToStock
                        ? `$${activeToken.symbol} → ${activeStock.symbol}`
                        : `${activeStock.symbol} → $${activeToken.symbol}`}
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-between gap-1 text-muted">
                    <span>Dual Price</span>
                    <div className="text-right font-mono text-ink text-[11px] tabular-nums">
                      <span className="block">1 ${activeToken.symbol} ≈ ${tokenPriceUsd} USD</span>
                      <span className="text-muted text-[10px]">
                        1 {activeStock.symbol} ≈ {rate.toLocaleString(undefined, { maximumFractionDigits: 0 })} {activeToken.symbol}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between text-muted items-center">
                    <span>Price Impact</span>
                    <span
                      className={`font-mono font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                        numericPriceImpact > 3
                          ? 'bg-red-950/60 text-red-400 border border-red-800/60'
                          : numericPriceImpact > 1
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                          : 'bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30'
                      }`}
                    >
                      {priceImpact}%
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-between gap-1 text-muted">
                    <span>Protocol &amp; Creator Fee</span>
                    <span className="font-mono text-ink text-[11px] tabular-nums text-right">
                      {creatorFeePercent}% Creator{activeToken?.isGraduated || useEthRoute ? ` + ${poolFeePercent}% v4 LP` : ''}
                      {isSepolia && ' + 0.10% Treasury'} (~{estimatedFeeB20} {activeStock.symbol})
                    </span>
                  </div>

                  {isSepolia && (
                    <div className="flex justify-between items-center text-muted pt-1.5 border-t border-white/[0.06]">
                      <span className="text-[11px] flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#00E599]" strokeWidth={1.6} />
                        Testnet Treasury (0.10% Cap)
                      </span>
                      <a
                        href="https://sepolia.basescan.org/address/0xc96147c68ca8e153e70B3bC4745b8d974bDd212A"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-[#7CA8FF] hover:underline flex items-center gap-1"
                      >
                        <span>0xc961...212A</span>
                        <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
                      </a>
                    </div>
                  )}
                </div>

                {txState === 'CONFIRMED' && lastTxHash && (
                  <div className="p-3 bg-[#00E599]/10 border border-[#00E599]/35 rounded-xl text-xs text-[#00E599] flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
                      <span>Confirmed on Base Sepolia</span>
                    </div>
                    <a
                      href={`${explorerUrl}/tx/${lastTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 underline hover:text-white font-mono"
                    >
                      <span>BaseScan</span>
                      <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
                    </a>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 bg-red-950/50 border border-red-800/70 rounded-xl text-xs text-red-300 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={1.6} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Tactile Swap Action */}
                <div>
                  {!isConnected ? (
                    <TactileButton disabled variant="secondary" className="w-full py-3.5 text-xs">
                      Connect Wallet to Trade
                    </TactileButton>
                  ) : isMainnet && isMainnetPaused ? (
                    <TactileButton
                      variant="secondary"
                      onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                      className="w-full py-3.5 text-xs space-x-2 border-amber-700/70 text-amber-200"
                    >
                      <Pause className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
                      <span>Mainnet Paused — Switch to Base Sepolia</span>
                    </TactileButton>
                  ) : parsedFrom > userPayingBalance ? (
                    <div className="space-y-2">
                      <TactileButton disabled variant="secondary" className="w-full py-3.5 text-xs">
                        Insufficient {isTokenToStock ? activeToken.symbol : baseAssetSymbol} Balance
                      </TactileButton>
                      {!isTokenToStock && !useEthRoute && isSepolia && (
                        <TactileButton
                          variant="emerald"
                          onClick={() => setIsFaucetOpen(true)}
                          className="w-full py-2.5 text-xs space-x-1.5"
                        >
                          <Droplets className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Claim Free {activeStock.symbol}</span>
                        </TactileButton>
                      )}
                    </div>
                  ) : exceedsMaxWallet ? (
                    <TactileButton disabled variant="secondary" className="w-full py-3.5 text-xs text-amber-300 border-amber-800/60">
                      Exceeds {((activeToken.maxWalletBps || 200) / 100).toFixed(1)}% Max-Wallet Cap — Lower Amount
                    </TactileButton>
                  ) : (
                    <TactileButton
                      variant={useEthRoute ? 'emerald' : 'primary'}
                      disabled={parsedFrom <= 0 || isQuoting || txState !== 'IDLE' || (useEthRoute && !isEthPoolSeeded)}
                      onClick={handleSwap}
                      className="w-full py-3.5 text-xs space-x-2"
                    >
                      {txState === 'APPROVING' && (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                          <span>Confirm Approval in Wallet...</span>
                        </>
                      )}
                      {txState === 'SWAPPING' && (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                          <span>Confirming On-Chain Swap...</span>
                        </>
                      )}
                      {txState === 'IDLE' && (
                        <span>
                          {useEthRoute
                            ? isTokenToStock
                              ? `Sell $${activeToken.symbol} → ${activeStock.symbol} → ETH`
                              : `Buy $${activeToken.symbol} with ETH`
                            : `Swap ${activeStock.symbol} / $${activeToken.symbol}`}
                        </span>
                      )}
                      {txState === 'CONFIRMED' && <span>Trade Confirmed On-Chain</span>}
                    </TactileButton>
                  )}
                </div>
              </SpotlightCard>
            ) : (
              <LiquidityViewer
                tokenSymbol={activeToken.symbol}
                stockSymbol={activeStock.symbol}
                stockPriceUsd={activeToken.stockPriceUsd}
                multiplier={mockMultiplier}
                isGraduated={activeToken.isGraduated}
                b20Reserve={activeToken.b20Reserve}
                tokenReserve={activeToken.tokenReserve}
                sharesAccumulated={activeToken.sharesAccumulated}
                targetShares={activeToken.targetShares}
                tokenAddress={activeToken.tokenAddress}
                curveAddress={activeToken.curveAddress}
              />
            )}
          </div>
        </div>
      ) : null}

      {/* Asymmetric 2:1 Editorial Feature & Architecture Section (Anti-Slop Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <SpotlightCard
          outerClassName="lg:col-span-2"
          className="p-6 sm:p-7 flex flex-col justify-between space-y-5"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-mono text-[10px] uppercase tracking-micro text-[#00E599]">
                Unified Protocol Pipeline
              </span>
              <span className="text-[11px] font-mono text-muted">
                Zero Admin Custody • Non-Upgradeable
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-semibold text-white tracking-tight">
              From Native ETH to Equity-Backed Liquidity in One Transaction
            </h2>
            <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
              Every trade passes cleanly through <span className="font-mono text-ink">BulldotRouter</span>: Native ETH enters Uniswap v4&apos;s <span className="font-mono text-ink">PoolManager</span>, converts to the paired B20 stock, and settles into an autonomous <span className="font-mono text-ink">BulldotBondingCurve</span>. At 50 canonical shares, liquidity graduates irreversibly to Uniswap v4.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <Link
              href="/launch"
              className="p-3.5 rounded-xl bg-[#080B10] border border-white/[0.07] hover:border-[#00E599]/40 transition-colors group"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span>Launchpad</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#00E599] group-hover:translate-x-0.5 transition-transform" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] text-muted mt-1">
                Zero-capital fair curves or instant v4 locks.
              </p>
            </Link>

            <Link
              href="/explore"
              className="p-3.5 rounded-xl bg-[#080B10] border border-white/[0.07] hover:border-[#0052FF]/50 transition-colors group"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span>Explore Pools</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#7CA8FF] group-hover:translate-x-0.5 transition-transform" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] text-muted mt-1">
                Inspect live reserves &amp; curve graduation.
              </p>
            </Link>

            <Link
              href="/dashboard"
              className="p-3.5 rounded-xl bg-[#080B10] border border-white/[0.07] hover:border-[#00E599]/40 transition-colors group"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-white">
                <span>Creator Hub</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#00E599] group-hover:translate-x-0.5 transition-transform" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] text-muted mt-1">
                Claim fees or redirect yields to stock burns.
              </p>
            </Link>
          </div>
        </SpotlightCard>

        <SpotlightCard
          accent="blue"
          outerClassName="lg:col-span-1"
          className="p-6 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-micro text-[#7CA8FF]">
              <Lock className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Security Invariants</span>
            </div>
            <h3 className="font-display text-lg font-semibold text-white tracking-tight">
              Built to Run Unattended
            </h3>
            <ul className="space-y-2 text-xs text-muted">
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] mt-1.5 shrink-0" />
                <span>Split-invariant B20 graduation normalized in canonical shares.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] mt-1.5 shrink-0" />
                <span>Router holds zero custody; excess capital auto-refunds.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] mt-1.5 shrink-0" />
                <span>100% of LP minted permanently to <span className="font-mono text-ink">0x...dEaD</span>.</span>
              </li>
            </ul>
          </div>

          <TactileLink
            href="/docs"
            variant="secondary"
            wrapperClassName="pt-2 block w-full"
            className="w-full py-2.5 text-xs space-x-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#7CA8FF]" strokeWidth={1.6} />
            <span>Read Full Documentation</span>
          </TactileLink>
        </SpotlightCard>
      </div>
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 font-mono text-xs text-muted">Loading exchange...</div>}>
      <SwapContent />
    </Suspense>
  );
}
