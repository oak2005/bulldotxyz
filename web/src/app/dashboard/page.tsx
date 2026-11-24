'use client';

import React, { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import {
  ShieldCheck,
  Coins,
  ArrowRightLeft,
  CheckCircle2,
  Building2,
  ExternalLink,
  Flame,
  Droplets,
  Layers,
  RefreshCw,
  Users,
  AlertTriangle,
  Pause,
  Lock,
} from 'lucide-react';
import { useProtocol, TokenPair } from '../../context/ProtocolContext';

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
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
  const burnedShares = currentToken?.treasuryBurnedShares || 0;

  const handleClaim = async () => {
    if (!currentToken || claimable <= 0) return;
    setIsClaiming(true);
    setErrorMessage(null);

    try {
      let hash = '';
      if (currentToken.isTreasuryRedirected) {
        hash = await executeBurnFeesToTreasury(currentToken.symbol);
      } else {
        hash = await executeClaimFees(currentToken.symbol);
      }
      setLastTxHash(hash);
      setTimeout(() => setLastTxHash(null), 8000);
    } catch (err: any) {
      console.error('Claim failed:', err);
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
      const hash = await executeRedirectFees(currentToken.symbol, newRecipient);
      setLastTxHash(hash);
      setNewRecipient('');
      setTimeout(() => setLastTxHash(null), 8000);
    } catch (err: any) {
      console.error('Redirect failed:', err);
      setErrorMessage(err?.message || 'Transaction was rejected or failed.');
    } finally {
      setIsRedirecting(false);
    }
  };

  const handleRenounce = async () => {
    if (!currentToken) return;
    const confirm = window.confirm(
      `Are you sure you want to permanently renounce manager rights for $${currentToken.symbol}? This will permanently lock fee routing and make treasury burns immutable.`
    );
    if (!confirm) return;

    setIsRenouncing(true);
    setErrorMessage(null);

    try {
      const hash = await executeRenounceManagement(currentToken.symbol);
      setLastTxHash(hash);
      setTimeout(() => setLastTxHash(null), 8000);
    } catch (err: any) {
      console.error('Renounce failed:', err);
      setErrorMessage(err?.message || 'Transaction was rejected or failed.');
    } finally {
      setIsRenouncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Creator & Community Hub</h1>
        <p className="text-sm text-gray-400 mt-1">
          Monitor your B20 stock fee rewards, claim accumulated earnings, or redirect fees to support stock treasuries.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('METRICS')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'METRICS'
              ? 'bg-surface text-white border border-border shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Fee Earnings & Claims
        </button>
        <button
          onClick={() => setActiveTab('REDIRECT')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'REDIRECT'
              ? 'bg-surface text-white border border-border shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Fee Redirection Manager
        </button>
        <button
          onClick={() => setActiveTab('COMMUNITY')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center space-x-1.5 ${
            activeTab === 'COMMUNITY'
              ? 'bg-surface text-white border border-border shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-primary" />
          <span>Community Stock Treasuries</span>
        </button>
      </div>

      {/* Active Token Selector (Tabs 1 & 2) */}
      {activeTab !== 'COMMUNITY' && communityTokens.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">Select Managed Token:</span>
          <div className="flex items-center space-x-2 overflow-x-auto">
            {communityTokens.map((token, idx) => (
              <button
                key={token.symbol}
                onClick={() => setSelectedTokenIndex(idx)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedTokenIndex === idx
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-background text-gray-400 hover:text-white border border-border'
                }`}
              >
                ${token.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Notification Banner */}
      {lastTxHash && (
        <div className="p-3 bg-green-950/40 border border-green-800 rounded-xl text-xs text-green-300 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span>Transaction executed successfully on Base!</span>
          </div>
          <a
            href={`${explorerUrl}/tx/${lastTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 underline hover:text-white"
          >
            <span>View on BaseScan</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-xs text-red-300 flex items-center space-x-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: METRICS & CLAIM */}
      {activeTab === 'METRICS' && currentToken && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Total Lifetime Collected */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
              <span className="text-xs text-gray-400 block font-medium">Total Lifetime Fees</span>
              <div className="text-2xl font-bold text-white">
                {totalCollected.toFixed(3)} {currentToken.pairedStockSymbol}
              </div>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                ~${(totalCollected * currentToken.stockPriceUsd).toFixed(2)} USD value
              </p>
            </div>

            {/* Card 2: Active Fee Recipient */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
              <span className="text-xs text-gray-400 block font-medium">Active Fee Destination</span>
              <div className="text-sm font-mono font-bold text-white truncate">
                {currentToken.isTreasuryRedirected ? (
                  <span className="text-primary flex items-center gap-1 font-sans text-xs">
                    <Building2 className="w-3.5 h-3.5" />
                    Coinbase Stock Treasury (Buyback)
                  </span>
                ) : (
                  currentToken.feeRecipient || 'Creator Address'
                )}
              </div>
              <p className="text-[11px] text-success flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Autonomous on-chain vault routing
              </p>
            </div>

            {/* Card 3: Claimable Balance */}
            <div className="bg-surface border border-primary/40 rounded-xl p-5 space-y-3">
              <span className="text-xs text-primary font-semibold block">Available to Claim</span>
              <div className="text-2xl font-extrabold text-white">
                {claimable.toFixed(3)} {currentToken.pairedStockSymbol}
              </div>
              <span className="text-[11px] text-gray-400 block">
                ≈ ${(claimable * currentToken.stockPriceUsd).toFixed(2)} USD
              </span>

              {isMainnet && isMainnetPaused ? (
                <button
                  onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                  className="w-full py-2.5 rounded-lg text-xs font-bold bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700 flex items-center justify-center space-x-1"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mainnet Paused</span>
                </button>
              ) : (
                <button
                  disabled={!isConnected || isClaiming || claimable <= 0}
                  onClick={handleClaim}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 ${
                    currentToken.isTreasuryRedirected
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-primary hover:bg-primary-hover text-white'
                  } disabled:bg-surface-hover disabled:text-gray-500`}
                >
                  {isClaiming ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Confirming in Wallet...</span>
                    </>
                  ) : currentToken.isTreasuryRedirected ? (
                    <>
                      <Flame className="w-3.5 h-3.5" />
                      <span>Burn to Treasury (Permissionless)</span>
                    </>
                  ) : (
                    <span>Claim B20 Stock Fees</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Fee Vault Security Note */}
          <div className="p-3 bg-surface border border-border rounded-xl text-xs text-gray-400 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong className="text-gray-200">Non-Custodial Fee Guarantee:</strong> Fee deposits are locked in BulldotFeeVault. No protocol admin can freeze, divert, or withdraw fees. Only the designated token manager or fee recipient can claim or redirect.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: REDIRECTION MANAGER */}
      {activeTab === 'REDIRECT' && currentToken && (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-white">Redirect Creator Fees for ${currentToken.symbol}</h2>
            <p className="text-xs text-gray-400 mt-1">
              Direct future fees to the official Coinbase Stock Treasury (to buyback and burn shares), a community DAO multisig, or your personal wallet.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-xs text-gray-400 block mb-2 font-medium">Select Redirection Destination Preset:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Preset 1: Stock Treasury */}
                <button
                  type="button"
                  onClick={() => setNewRecipient('0x000000000000000000000000000000000000dEaD')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    newRecipient === '0x000000000000000000000000000000000000dEaD'
                      ? 'border-primary bg-primary/10 text-white font-medium shadow-md'
                      : 'border-border bg-background/40 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-primary mb-1" />
                  <span className="font-semibold block text-sm">Stock Treasury</span>
                  <span className="text-[11px] text-gray-400">Burns fees to increase canonical share value</span>
                </button>

                {/* Preset 2: Connected Wallet */}
                <button
                  type="button"
                  onClick={() => setNewRecipient(address || '')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    newRecipient === address
                      ? 'border-primary bg-primary/10 text-white font-medium shadow-md'
                      : 'border-border bg-background/40 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4 text-warning mb-1" />
                  <span className="font-semibold block text-sm">Connected Wallet</span>
                  <span className="text-[11px] text-gray-400">Reverts destination to creator address</span>
                </button>
              </div>
            </div>

            {/* Custom Recipient Input */}
            <div>
              <span className="text-xs text-gray-400 block mb-1 font-medium">Or Enter Custom Recipient Address:</span>
              <input
                type="text"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="0x... Target Address"
                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {isMainnet && isMainnetPaused ? (
                <button
                  onClick={() => switchChain?.({ chainId: baseSepolia.id })}
                  className="w-full py-3 rounded-xl text-xs font-bold bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-700 flex items-center justify-center space-x-1"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mainnet Paused — Switch to Base Sepolia Testnet</span>
                </button>
              ) : (
                <>
                  <button
                    disabled={!isConnected || isRedirecting || !newRecipient}
                    onClick={handleRedirect}
                    className="w-full py-3 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:text-gray-500 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 shadow-md"
                  >
                    {isRedirecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Confirming Redirection in Wallet...</span>
                      </>
                    ) : (
                      <span>Update Fee Recipient for ${currentToken.symbol}</span>
                    )}
                  </button>

                  <button
                    disabled={!isConnected || isRenouncing}
                    onClick={handleRenounce}
                    className="w-full py-2.5 bg-background hover:bg-surface border border-red-900/50 hover:border-red-700 text-red-400 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5"
                    title="Permanently relinquishes creator ability to change the recipient."
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Renounce Manager Rights (Lock Permanently)</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMMUNITY STOCK TREASURIES */}
      {activeTab === 'COMMUNITY' && (
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Stock Treasury Alignment Ecosystem</h2>
                <p className="text-xs text-gray-400">
                  Projects that permanently redirect creator fees to Coinbase tokenized stock treasuries to buyback and burn shares.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {communityTokens
                .filter((t) => t.isTreasuryRedirected)
                .map((token) => (
                  <div
                    key={token.symbol}
                    className="p-4 bg-background border border-border rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-sm">${token.symbol}</span>
                        <span className="text-xs text-gray-400">({token.name})</span>
                      </div>
                      <span className="text-[10px] bg-green-950/60 text-green-300 px-2 py-0.5 rounded-full border border-green-800">
                        Active Treasury
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-gray-300">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Pairing Stock:</span>
                        <span className="font-bold">{token.pairedStockSymbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Cumulative Burned Shares:</span>
                        <span className="text-primary font-bold">
                          {(token.treasuryBurnedShares || 0).toFixed(2)} shares
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Unclaimed Pool Balance:</span>
                        <span className="text-warning font-medium">
                          {(token.claimableRawFees || 0).toFixed(3)} {token.pairedStockSymbol}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
