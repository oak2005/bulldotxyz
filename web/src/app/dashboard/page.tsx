'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import {
  SpotlightCard,
  TactileButton,
  TactileLink,
  Reveal,
  snappySpring,
} from '../../components/MotionPrimitives';
import { TokenEmblem } from '../../components/BrandAssets';
import {
  ShieldCheck,
  ArrowRightLeft,
  CheckCircle2,
  Building2,
  ExternalLink,
  Flame,
  RefreshCw,
  AlertTriangle,
  Pause,
  Lock,
  Rocket,
} from 'lucide-react';
import { useProtocol, TokenPair } from '../../context/ProtocolContext';

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { switchChain } = useSwitchChain();

  const {
    isMainnet,
    isSepolia,
    isMainnetPaused,
    communityTokens,
    executeClaimFees,
    executeBurnFeesToTreasury,
    executeRedirectFees,
    executeRenounceManagement,
  } = useProtocol();

  const explorerUrl = isSepolia ? 'https://sepolia.basescan.org' : 'https://basescan.org';

  const [activeTab, setActiveTab] = useState<'METRICS' | 'REDIRECT' | 'COMMUNITY'>('METRICS');
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [newRecipient, setNewRecipient] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isRenouncing, setIsRenouncing] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentToken: TokenPair = communityTokens[selectedTokenIndex] || communityTokens[0];
  const claimable = currentToken?.claimableRawFees || 0;
  const totalCollected = currentToken?.totalCollectedRawFees || 0;
  const isTokenManager = Boolean(
    address &&
      currentToken?.tokenManager &&
      address.toLowerCase() === currentToken.tokenManager.toLowerCase()
  );
  const isFeeRecipient = Boolean(
    address &&
      currentToken?.feeRecipient &&
      address.toLowerCase() === currentToken.feeRecipient.toLowerCase()
  );
  const canClaimFees = Boolean(
    currentToken &&
      claimable > 0 &&
      (currentToken.isTreasuryRedirected || isTokenManager || isFeeRecipient)
  );

  const handleClaim = async () => {
    if (!currentToken || !canClaimFees) return;
    setIsClaiming(true);
    setErrorMessage(null);

    try {
      const hash = currentToken.isTreasuryRedirected
        ? await executeBurnFeesToTreasury(currentToken.tokenAddress)
        : await executeClaimFees(currentToken.tokenAddress);
      setLastTxHash(hash);
      setTimeout(() => setLastTxHash(null), 8000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Transaction was rejected or failed.');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleRedirect = async () => {
    if (!newRecipient || !currentToken) return;
    setIsRedirecting(true);
    setErrorMessage(null);

    try {
      const hash = await executeRedirectFees(currentToken.tokenAddress, newRecipient);
      setLastTxHash(hash);
      setNewRecipient('');
      setTimeout(() => setLastTxHash(null), 8000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Transaction was rejected or failed.');
    } finally {
      setIsRedirecting(false);
    }
  };

  const handleRenounce = async () => {
    if (!currentToken) return;
    const confirmed = window.confirm(
      `Permanently renounce manager rights for $${currentToken.symbol}? Fee routing becomes immutable.`
    );
    if (!confirmed) return;

    setIsRenouncing(true);
    setErrorMessage(null);

    try {
      const hash = await executeRenounceManagement(currentToken.tokenAddress);
      setLastTxHash(hash);
      setTimeout(() => setLastTxHash(null), 8000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Transaction was rejected or failed.');
    } finally {
      setIsRenouncing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Reveal className="border-b border-white/[0.08] pb-5">
        <span className="font-mono text-[10px] uppercase tracking-micro text-[#00E599]">
          Non-Custodial Fee Vault
        </span>
        <h1 className="font-display text-3xl font-semibold text-white tracking-display mt-0.5">
          Creator &amp; Treasury Hub
        </h1>
        <p className="text-sm text-muted mt-1">
          Track equity fee accumulation, claim rewards, or direct protocol yields into Stock Treasury burns.
        </p>
      </Reveal>

      {/* Spring Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-[#0E141C] border border-white/[0.08] rounded-xl p-1 w-fit">
        {[
          { id: 'METRICS' as const, label: 'Fee Claims' },
          { id: 'REDIRECT' as const, label: 'Fee Redirection' },
          { id: 'COMMUNITY' as const, label: 'Stock Treasuries' },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                active ? 'text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="dashboard-tab-pill"
                  transition={snappySpring}
                  className="absolute inset-0 rounded-lg bg-[#0052FF]"
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab !== 'COMMUNITY' && communityTokens.length > 0 && (
        <div className="bg-[#0E141C] border border-white/[0.08] rounded-xl p-3 flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-micro text-muted font-medium">
            Managed Token:
          </span>
          <div className="flex items-center space-x-2 overflow-x-auto">
            {communityTokens.map((token, idx) => (
              <button
                key={token.tokenAddress}
                onClick={() => setSelectedTokenIndex(idx)}
                className={`px-3 py-1 rounded-lg font-mono text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedTokenIndex === idx
                    ? 'bg-[#00E599] text-[#05120D] font-semibold'
                    : 'bg-[#080B10] text-muted hover:text-white border border-white/[0.08]'
                }`}
              >
                ${token.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {lastTxHash && (
        <div className="p-3 bg-[#00E599]/10 border border-[#00E599]/35 rounded-xl text-xs text-[#00E599] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
            <span>Vault action confirmed on Base Sepolia</span>
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
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" strokeWidth={1.6} />
          <span>{errorMessage}</span>
        </div>
      )}

      {communityTokens.length === 0 ? (
        <SpotlightCard className="p-10 sm:p-14 text-center space-y-4">
          <div className="w-12 h-12 bg-[#00E599]/10 border border-[#00E599]/30 rounded-2xl flex items-center justify-center mx-auto text-[#00E599]">
            <Building2 className="w-6 h-6" strokeWidth={1.6} />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="font-display text-xl font-semibold text-white">No Managed Pools Yet</h3>
            <p className="text-xs text-muted leading-relaxed">
              Launch a community token on Base Sepolia to track creator fees, execute equity buybacks, or direct yields to stock treasuries.
            </p>
          </div>
          <div className="pt-2">
            <TactileLink href="/launch" variant="emerald" className="px-5 py-2.5 text-xs space-x-1.5">
              <Rocket className="w-4 h-4" strokeWidth={1.75} />
              <span>Launch Token</span>
            </TactileLink>
          </div>
        </SpotlightCard>
      ) : (
        <>
          {activeTab === 'METRICS' && currentToken && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SpotlightCard className="p-5 space-y-2">
                  <span className="text-xs text-muted block font-medium">Lifetime Fees Collected</span>
                  <div className="font-mono text-2xl font-semibold text-white tabular-nums">
                    {totalCollected.toFixed(4)} {currentToken.pairedStockSymbol}
                  </div>
                  <p className="text-[11px] font-mono text-muted flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#7CA8FF]" strokeWidth={1.6} />
                    ~${(totalCollected * currentToken.stockPriceUsd).toFixed(2)} USD
                  </p>
                </SpotlightCard>

                <SpotlightCard className="p-5 space-y-2">
                  <span className="text-xs text-muted block font-medium">Fee Recipient</span>
                  <div className="text-sm font-mono font-semibold text-white truncate">
                    {currentToken.isTreasuryRedirected ? (
                      <span className="text-[#00E599] flex items-center gap-1.5 font-sans text-xs">
                        <Building2 className="w-4 h-4" strokeWidth={1.6} />
                        Stock Treasury Burn (0x...dEaD)
                      </span>
                    ) : (
                      currentToken.feeRecipient || 'Creator Address'
                    )}
                  </div>
                  <p className="text-[11px] text-[#00E599] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                    Autonomous FeeVault routing
                  </p>
                </SpotlightCard>

                <SpotlightCard
                  accent="emerald"
                  outerClassName="border-[#00E599]/35"
                  className="p-5 space-y-3"
                >
                  <span className="text-xs text-[#00E599] font-semibold block">Available to Claim</span>
                  <div className="font-mono text-2xl font-semibold text-white tabular-nums">
                    {claimable.toFixed(4)} {currentToken.pairedStockSymbol}
                  </div>
                  <span className="font-mono text-[11px] text-muted block">
                    ≈ ${(claimable * currentToken.stockPriceUsd).toFixed(2)} USD
                  </span>

                  {isMainnet && isMainnetPaused ? (
                    <TactileButton
                      variant="secondary"
                      onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                      className="w-full py-2.5 text-xs space-x-1.5"
                    >
                      <Pause className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.6} />
                      <span>Mainnet Paused</span>
                    </TactileButton>
                  ) : (
                    <TactileButton
                      variant={currentToken.isTreasuryRedirected ? 'emerald' : 'primary'}
                      disabled={!isConnected || isClaiming || !canClaimFees}
                      onClick={handleClaim}
                      className="w-full py-2.5 text-xs space-x-1.5"
                    >
                      {isClaiming ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                          <span>Confirming...</span>
                        </>
                      ) : currentToken.isTreasuryRedirected ? (
                        <>
                          <Flame className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Burn to Treasury (Permissionless)</span>
                        </>
                      ) : (
                        <span>Claim Equity Fees</span>
                      )}
                    </TactileButton>
                  )}
                </SpotlightCard>
              </div>
            </div>
          )}

          {activeTab === 'REDIRECT' && currentToken && (
            <SpotlightCard outerClassName="max-w-xl" className="p-6 space-y-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-white">
                  Redirect Fees for ${currentToken.symbol}
                </h2>
                <p className="text-xs text-muted mt-1">
                  Route future equity fees to Stock Treasury burn (<span className="font-mono">0x...dEaD</span>), a DAO multisig, or your wallet.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewRecipient('0x000000000000000000000000000000000000dEaD')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      newRecipient === '0x000000000000000000000000000000000000dEaD'
                        ? 'border-[#00E599]/60 bg-[#00E599]/10 text-white'
                        : 'border-white/[0.08] bg-[#080B10]/70 text-muted hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-[#00E599] mb-1.5" strokeWidth={1.6} />
                    <span className="font-semibold block text-sm text-white">Stock Treasury</span>
                    <span className="text-[11px] text-muted">Burns equity yield forever</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewRecipient(address || '')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      newRecipient === address
                        ? 'border-[#0052FF]/70 bg-[#0052FF]/12 text-white'
                        : 'border-white/[0.08] bg-[#080B10]/70 text-muted hover:text-white'
                    }`}
                  >
                    <ArrowRightLeft className="w-4 h-4 text-[#7CA8FF] mb-1.5" strokeWidth={1.6} />
                    <span className="font-semibold block text-sm text-white">Connected Wallet</span>
                    <span className="text-[11px] text-muted">Set destination to self</span>
                  </button>
                </div>

                <div>
                  <span className="text-xs text-muted block mb-1">Custom 0x Recipient</span>
                  <input
                    type="text"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    placeholder="0x... Target Address"
                    className="w-full bg-[#080B10] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#0052FF] font-mono"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  {isMainnet && isMainnetPaused ? (
                    <TactileButton
                      variant="secondary"
                      onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                      className="w-full py-3 text-xs space-x-1.5"
                    >
                      <Pause className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.6} />
                      <span>Mainnet Paused — Switch to Base Sepolia</span>
                    </TactileButton>
                  ) : currentToken.isManagerRenounced ? (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex items-center space-x-2">
                      <Lock className="w-4 h-4 text-amber-400 shrink-0" strokeWidth={1.6} />
                      <span>Manager rights permanently renounced on-chain. Fee routing is immutable.</span>
                    </div>
                  ) : (
                    <>
                      {!isTokenManager && isConnected && (
                        <div className="p-2.5 rounded-xl bg-[#080B10] border border-white/[0.08] text-[11px] text-amber-300 font-mono">
                          Wallet is not token manager ({currentToken.tokenManager?.slice(0, 6)}...{currentToken.tokenManager?.slice(-4)}).
                        </div>
                      )}
                      <TactileButton
                        variant="primary"
                        disabled={!isConnected || !isTokenManager || isRedirecting || !newRecipient}
                        onClick={handleRedirect}
                        className="w-full py-3 text-xs space-x-2"
                      >
                        {isRedirecting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                            <span>Confirming Redirection...</span>
                          </>
                        ) : (
                          <span>Update Fee Recipient</span>
                        )}
                      </TactileButton>

                      <TactileButton
                        variant="danger"
                        disabled={!isConnected || !isTokenManager || isRenouncing}
                        onClick={handleRenounce}
                        className="w-full py-2.5 text-xs space-x-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" strokeWidth={1.6} />
                        <span>Renounce Manager Rights Forever</span>
                      </TactileButton>
                    </>
                  )}
                </div>
              </div>
            </SpotlightCard>
          )}

          {activeTab === 'COMMUNITY' && (
            <SpotlightCard className="p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-[#00E599]/10 rounded-xl text-[#00E599] border border-[#00E599]/30">
                  <Building2 className="w-5 h-5" strokeWidth={1.6} />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-white">
                    Treasury-Aligned Tokens
                  </h2>
                  <p className="text-xs text-muted">
                    Tokens redirecting swap fees straight into permanent tokenized stock treasury burns.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {communityTokens
                  .filter((t) => t.isTreasuryRedirected)
                  .map((token) => (
                    <div
                      key={token.tokenAddress}
                      className="p-4 bg-[#080B10] border border-white/[0.08] rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2.5">
                          <TokenEmblem symbol={token.symbol} size="sm" />
                          <div>
                            <span className="font-mono font-semibold text-white text-sm">${token.symbol}</span>
                            <span className="text-xs text-muted ml-1.5">{token.name}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono bg-[#00E599]/10 text-[#00E599] px-2 py-0.5 rounded border border-[#00E599]/30">
                          Aligned
                        </span>
                      </div>

                      <div className="text-xs space-y-1 font-mono text-muted">
                        <div className="flex justify-between">
                          <span>Paired Equity:</span>
                          <span className="text-white">{token.pairedStockSymbol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Burned Balance:</span>
                          <span className="text-[#00E599]">
                            {(token.treasuryBurnedShares || 0).toFixed(4)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending Burn:</span>
                          <span className="text-white">
                            {(token.claimableRawFees || 0).toFixed(4)} {token.pairedStockSymbol}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </SpotlightCard>
          )}
        </>
      )}
    </div>
  );
}
