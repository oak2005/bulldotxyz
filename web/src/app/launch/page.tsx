'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { VERIFIED_B20_STOCKS } from '../../config/stocks';
import { StockEquityBadge } from '../../components/BrandAssets';
import {
  SpotlightCard,
  TactileButton,
  TactileLink,
  Reveal,
  snappySpring,
} from '../../components/MotionPrimitives';
import {
  ShieldCheck,
  Rocket,
  Flame,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Pause,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useProtocol, TokenPair } from '../../context/ProtocolContext';

export default function LaunchPage() {
  const { isConnected } = useAccount();
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
    <div className="max-w-3xl mx-auto space-y-6">
      <Reveal className="space-y-1.5">
        <span className="font-mono text-[10px] uppercase tracking-micro text-[#00E599]">
          Token Deployment Factory
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white tracking-display">
          Launch an Equity-Paired Token
        </h1>
        <p className="text-sm text-muted">
          Deploy via BulldotFactory directly onto Base Sepolia with immutable supply and Uniswap v4 permanence.
        </p>
      </Reveal>

      {deployedTx && deployedToken && (
        <SpotlightCard
          accent="emerald"
          outerClassName="border-[#00E599]/40"
          className="p-5 text-xs text-[#00E599] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold text-base text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#00E599]" strokeWidth={1.75} />
              <span>Deployed On-Chain to Base Sepolia</span>
            </span>
            <a
              href={`${explorerUrl}/tx/${deployedTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 underline hover:text-white font-mono"
            >
              <span>BaseScan</span>
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.6} />
            </a>
          </div>

          <p className="text-ink/85 leading-relaxed">
            <strong>${deployedToken.symbol}</strong> ({deployedToken.name}) is deployed via <span className="font-mono">BulldotFactory</span> and paired with{' '}
            <strong>{deployedToken.pairedStockSymbol}</strong>. Official verification granted on-chain.
          </p>

          {deployedToken.tokenAddress !== '0x0000000000000000000000000000000000000000' && (
            <div className="text-[11px] font-mono text-muted flex items-center gap-2">
              <span>Token:</span>
              <a
                href={`${explorerUrl}/token/${deployedToken.tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-white flex items-center gap-1"
              >
                <span>{deployedToken.tokenAddress}</span>
                <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
              </a>
            </div>
          )}

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <TactileLink
              href={`/?pair=${deployedToken.tokenAddress !== '0x0000000000000000000000000000000000000000' ? deployedToken.tokenAddress : deployedToken.symbol}`}
              variant="emerald"
              className="px-4 py-2 text-xs space-x-1.5"
            >
              <span>Trade ${deployedToken.symbol} Now</span>
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
            </TactileLink>
            <TactileLink href="/explore" variant="secondary" className="px-4 py-2 text-xs">
              Explore Pools
            </TactileLink>
          </div>
        </SpotlightCard>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-950/50 border border-red-800/70 rounded-xl text-xs text-red-300 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={1.6} />
          <span>{errorMessage}</span>
        </div>
      )}

      <SpotlightCard className="p-6 sm:p-8 space-y-6">
        {/* Step 1: Launch Mode */}
        <div className="space-y-3">
          <label className="text-[11px] uppercase tracking-micro font-medium text-muted block">
            01 / Launch Architecture
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.99 }}
              transition={snappySpring}
              onClick={() => setMode('CURVE')}
              className={`p-4 rounded-xl border text-left transition-colors ${
                mode === 'CURVE'
                  ? 'border-[#0052FF] bg-[#0052FF]/12'
                  : 'border-white/[0.08] bg-[#080B10]/70 hover:border-white/[0.16]'
              }`}
            >
              <div className="flex items-center space-x-2 text-[#7CA8FF] font-display font-semibold text-base mb-1">
                <Rocket className="w-4 h-4" strokeWidth={1.75} />
                <span>Fair Launch Curve</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Zero upfront capital required. Community trades on an autonomous AMM curve until 50 canonical shares accumulate, then graduates to Uniswap v4.
              </p>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.99 }}
              transition={snappySpring}
              onClick={() => setMode('INSTANT')}
              className={`p-4 rounded-xl border text-left transition-colors ${
                mode === 'INSTANT'
                  ? 'border-[#00E599] bg-[#00E599]/10'
                  : 'border-white/[0.08] bg-[#080B10]/70 hover:border-white/[0.16]'
              }`}
            >
              <div className="flex items-center space-x-2 text-[#00E599] font-display font-semibold text-base mb-1">
                <Flame className="w-4 h-4" strokeWidth={1.75} />
                <span>Instant Uniswap v4</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Seed initial stock liquidity directly into Uniswap v4 PoolManager. 100% of LP positions mint permanently to 0x...dEaD.
              </p>
            </motion.button>
          </div>
        </div>

        {/* Step 2: Pairing Equity */}
        <div className="space-y-2.5">
          <label className="text-[11px] uppercase tracking-micro font-medium text-muted block">
            02 / Paired Coinbase B20 Equity
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {VERIFIED_B20_STOCKS.map((stock) => {
              const selected = selectedStock.symbol === stock.symbol;
              return (
                <motion.button
                  key={stock.symbol}
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  transition={snappySpring}
                  onClick={() => setSelectedStock(stock)}
                  className={`p-3 rounded-xl border text-left transition-colors flex flex-col justify-between space-y-2 ${
                    selected
                      ? 'border-[#00E599]/60 bg-[#00E599]/10'
                      : 'border-white/[0.07] bg-[#080B10]/70 hover:border-white/[0.15]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <StockEquityBadge symbol={stock.symbol} size="sm" />
                    <ShieldCheck
                      className={`w-3.5 h-3.5 ${selected ? 'text-[#00E599]' : 'text-muted'}`}
                      strokeWidth={1.6}
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-xs">{stock.symbol}</div>
                    <div className="text-[10px] text-muted truncate">{stock.name}</div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Metadata */}
        <div className="space-y-2.5">
          <label className="text-[11px] uppercase tracking-micro font-medium text-muted block">
            03 / Token Identity
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-muted block mb-1">Token Name</span>
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. Base Equity Index"
                className="w-full bg-[#080B10] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#0052FF]"
              />
            </div>

            <div>
              <span className="text-xs text-muted block mb-1">Ticker Symbol</span>
              <input
                type="text"
                value={tokenSymbol}
                onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. BEQ"
                className="w-full bg-[#080B10] border border-white/[0.08] rounded-xl px-4 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-[#0052FF]"
              />
            </div>
          </div>
        </div>

        {mode === 'INSTANT' && (
          <div className="p-4 bg-[#080B10] border border-[#00E599]/30 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[#00E599] flex items-center gap-1.5">
                <Flame className="w-4 h-4" strokeWidth={1.6} />
                Initial {selectedStock.symbol} Deposit
              </span>
              <div className="flex items-center space-x-2 font-mono text-muted">
                <span>
                  Bal: {userStockBalance.toFixed(2)} {selectedStock.symbol}
                </span>
                {isSepolia && (
                  <button
                    type="button"
                    onClick={() => setIsFaucetOpen(true)}
                    className="text-[#00E599] underline font-semibold"
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
              placeholder="5"
              className="w-full bg-[#0E141C] border border-white/[0.08] rounded-xl px-4 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-[#00E599]"
            />

            {!hasEnoughDeposit && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.6} />
                Insufficient {selectedStock.symbol} balance. Claim from the Stock Faucet first.
              </p>
            )}
          </div>
        )}

        {/* Step 4: Anti-Sniper Cap */}
        {mode === 'CURVE' && (
          <div className="p-4 bg-[#080B10] border border-white/[0.07] rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#00E599]" strokeWidth={1.6} />
                <span className="text-xs font-semibold text-white">Anti-Sniper Max Wallet Limit</span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-micro text-muted">
                Active Until v4 Graduation
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
              {(['2%', '1%', 'OFF'] as const).map((cap) => {
                const active = antiDumpMode === cap;
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setAntiDumpMode(cap)}
                    className={`relative py-2 rounded-lg font-medium border transition-colors ${
                      active
                        ? 'text-white border-[#0052FF] bg-[#0052FF]/15'
                        : 'border-white/[0.08] bg-[#0E141C] text-muted hover:text-white'
                    }`}
                  >
                    {cap === '2%' ? '2% Max (Rec.)' : cap === '1%' ? '1% Strict' : 'Unlimited'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 5: Creator Fees & Treasury Routing */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[11px] uppercase tracking-micro font-medium text-muted">
              04 / Creator Fee ({creatorFee.toFixed(1)}%)
            </label>
            <span className="font-mono text-[11px] text-muted">Cap: 2.5% Max</span>
          </div>

          <input
            type="range"
            min="0"
            max="2.5"
            step="0.1"
            value={creatorFee}
            onChange={(e) => setCreatorFee(parseFloat(e.target.value))}
            className="w-full accent-[#00E599] cursor-pointer"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {[
              { key: 'CREATOR' as const, label: 'Connected Wallet' },
              { key: 'STOCK_TREASURY' as const, label: 'Stock Treasury Burn' },
              { key: 'CUSTOM' as const, label: 'Custom DAO / Vault' },
            ].map((dest) => {
              const active = feeDestination === dest.key;
              return (
                <button
                  key={dest.key}
                  type="button"
                  onClick={() => setFeeDestination(dest.key)}
                  className={`p-2.5 rounded-xl border text-left font-medium transition-colors ${
                    active
                      ? 'border-[#00E599]/60 bg-[#00E599]/10 text-white'
                      : 'border-white/[0.07] bg-[#080B10]/70 text-muted hover:text-white'
                  }`}
                >
                  {dest.label}
                </button>
              );
            })}
          </div>

          {feeDestination === 'CUSTOM' && (
            <input
              type="text"
              value={customRecipient}
              onChange={(e) => setCustomRecipient(e.target.value)}
              placeholder="0x... Custom Recipient Address"
              className="w-full bg-[#080B10] border border-white/[0.08] rounded-xl px-4 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-[#0052FF]"
            />
          )}
        </div>

        {/* Submit */}
        <div>
          {!isConnected ? (
            <TactileButton disabled variant="secondary" className="w-full py-4 text-xs">
              Connect Wallet to Deploy On-Chain
            </TactileButton>
          ) : isMainnet && isMainnetPaused ? (
            <TactileButton
              variant="secondary"
              onClick={() => switchChain?.({ chainId: baseSepolia.id })}
              className="w-full py-4 text-xs space-x-2 border-amber-700/70 text-amber-200"
            >
              <Pause className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
              <span>Mainnet Paused — Switch to Base Sepolia</span>
            </TactileButton>
          ) : mode === 'INSTANT' && !hasEnoughDeposit ? (
            <TactileButton disabled variant="secondary" className="w-full py-4 text-xs">
              Insufficient {selectedStock.symbol} Balance for Deposit
            </TactileButton>
          ) : (
            <TactileButton
              variant="emerald"
              disabled={isSubmitting || !tokenName || !tokenSymbol}
              onClick={handleLaunch}
              className="w-full py-4 text-xs space-x-2"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                  <span>Confirming Deployment on Base Sepolia...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" strokeWidth={1.75} />
                  <span>Deploy {tokenSymbol ? `$${tokenSymbol}` : 'Token'} On-Chain</span>
                </>
              )}
            </TactileButton>
          )}
        </div>
      </SpotlightCard>
    </div>
  );
}
