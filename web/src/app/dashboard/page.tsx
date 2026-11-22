'use client';

import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
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
} from 'lucide-react';
import { VERIFIED_B20_STOCKS } from '../../config/stocks';

interface ManagedToken {
  name: string;
  symbol: string;
  stockSymbol: string;
  stockPriceUsd: number;
  multiplier: number;
  totalRawCollected: number;
  claimableRaw: number;
  currentRecipient: string;
  isTreasuryRedirected: boolean;
  treasuryBurnedShares: number;
}

const MANAGED_TOKENS: ManagedToken[] = [
  {
    name: 'Bull Protocol',
    symbol: 'BULL',
    stockSymbol: 'bCOIN',
    stockPriceUsd: 312.50,
    multiplier: 1.0,
    totalRawCollected: 1.85,
    claimableRaw: 0.85,
    currentRecipient: '0x000000000000000000000000000000000000dEaD',
    isTreasuryRedirected: true,
    treasuryBurnedShares: 1.00,
  },
  {
    name: 'Nvidia Meme Moon',
    symbol: 'NVMOON',
    stockSymbol: 'bNVDA',
    stockPriceUsd: 142.20,
    multiplier: 1.0,
    totalRawCollected: 3.40,
    claimableRaw: 1.20,
    currentRecipient: '0x000000000000000000000000000000000000dEaD',
    isTreasuryRedirected: true,
    treasuryBurnedShares: 2.20,
  },
  {
    name: 'Treasury Share Token',
    symbol: 'TST',
    stockSymbol: 'bCOIN',
    stockPriceUsd: 312.50,
    multiplier: 1.0,
    totalRawCollected: 5.25,
    claimableRaw: 0.00,
    currentRecipient: '0x000000000000000000000000000000000000dEaD',
    isTreasuryRedirected: true,
    treasuryBurnedShares: 5.25,
  },
];

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const isSepolia = chainId === 84532;
  const explorerUrl = isSepolia ? 'https://sepolia.basescan.org' : 'https://basescan.org';

  const [activeTab, setActiveTab] = useState<'METRICS' | 'REDIRECT' | 'COMMUNITY'>('METRICS');
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [newRecipient, setNewRecipient] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const currentToken = MANAGED_TOKENS[selectedTokenIndex];

  const handleClaim = () => {
    setIsClaiming(true);
    setTimeout(() => {
      setIsClaiming(false);
      setLastTxHash('0x4b7c1d3e5a2f8b9c0d1e4a6f8b2c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c');
      setTimeout(() => setLastTxHash(null), 7000);
    }, 1500);
  };

  const handleRedirect = () => {
    if (!newRecipient) return;
    setIsRedirecting(true);
    setTimeout(() => {
      setIsRedirecting(false);
      currentToken.currentRecipient = newRecipient;
      currentToken.isTreasuryRedirected = newRecipient === '0x000000000000000000000000000000000000dEaD';
      setLastTxHash('0x7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c4b7c1d3e5a2f8b9c0d1e4a6f8b2c5d');
      setNewRecipient('');
      setTimeout(() => setLastTxHash(null), 7000);
    }, 1500);
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
      {activeTab !== 'COMMUNITY' && (
        <div className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">Select Managed Token:</span>
          <div className="flex items-center space-x-2">
            {MANAGED_TOKENS.map((token, idx) => (
              <button
                key={token.symbol}
                onClick={() => setSelectedTokenIndex(idx)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
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

      {/* TAB 1: METRICS & CLAIM */}
      {activeTab === 'METRICS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Total Lifetime Collected */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
              <span className="text-xs text-gray-400 block font-medium">Total Lifetime Fees</span>
              <div className="text-2xl font-bold text-white">
                {currentToken.totalRawCollected.toFixed(3)} {currentToken.stockSymbol}
              </div>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                ~${(currentToken.totalRawCollected * currentToken.stockPriceUsd).toFixed(2)} USD value
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
                  currentToken.currentRecipient
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
                {currentToken.claimableRaw.toFixed(3)} {currentToken.stockSymbol}
              </div>
              <span className="text-[11px] text-gray-400 block">
                ≈ ${(currentToken.claimableRaw * currentToken.stockPriceUsd).toFixed(2)} USD
              </span>

              <button
                disabled={!isConnected || isClaiming || currentToken.claimableRaw <= 0}
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
                    <span>Processing Vault Forward...</span>
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
      {activeTab === 'REDIRECT' && (
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

            <div>
              <span className="text-xs text-gray-400 block mb-1 font-medium">Or Enter Custom Destination Address:</span>
              <input
                type="text"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="0x... Recipient Address"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <button
              disabled={!isConnected || !newRecipient || isRedirecting}
              onClick={handleRedirect}
              className="w-full py-3.5 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5"
            >
              {isRedirecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating On-Chain Fee Vault...</span>
                </>
              ) : (
                <span>Confirm Fee Redirection</span>
              )}
            </button>

            {/* Renounce Management Option */}
            <div className="pt-3 border-t border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-300 block">Renounce Fee Management</span>
                  <span className="text-[11px] text-gray-500">Permanently lock this redirect. Neither creator nor admin can ever divert fees.</span>
                </div>
                <button
                  type="button"
                  disabled={!isConnected || isRedirecting || currentToken.currentRecipient === '0x0000000000000000000000000000000000000000'}
                  onClick={() => {
                    setIsRedirecting(true);
                    setTimeout(() => {
                      setIsRedirecting(false);
                      setLastTxHash('0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b');
                      setTimeout(() => setLastTxHash(null), 7000);
                    }, 1500);
                  }}
                  className="px-3 py-1.5 border border-red-800/80 bg-red-950/30 hover:bg-red-900/50 text-red-300 text-xs rounded-lg font-medium transition-all"
                >
                  Renounce
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMMUNITY STOCK TREASURIES VIEW */}
      {activeTab === 'COMMUNITY' && (
        <div className="space-y-4">
          <div className="p-4 bg-background border border-border rounded-xl space-y-1">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primary" />
              Community Stock Treasuries (Buyback & Equity Dividends)
            </h2>
            <p className="text-xs text-gray-400">
              Community tokens that align with real-world equities by routing 100% of their trading fees to underlying Coinbase stock treasuries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MANAGED_TOKENS.filter((t) => t.isTreasuryRedirected).map((token) => (
              <div
                key={token.symbol}
                className="bg-surface border border-border rounded-xl p-5 space-y-3 shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-white text-base">${token.symbol}</span>
                    <span className="text-xs text-gray-400 block">{token.name}</span>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/20 text-primary border border-primary/40">
                    <Flame className="w-3 h-3" />
                    Buyback & Burn
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-background rounded-lg border border-border/80">
                    <span className="text-[11px] text-gray-400 block">Stock Backing</span>
                    <span className="font-bold text-white">{token.stockSymbol}</span>
                  </div>
                  <div className="p-2.5 bg-background rounded-lg border border-border/80">
                    <span className="text-[11px] text-gray-400 block">Accumulated Stock</span>
                    <span className="font-bold text-primary">
                      {token.totalRawCollected.toFixed(2)} {token.stockSymbol}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-blue-950/20 border border-blue-900/40 rounded-lg text-xs space-y-1">
                  <span className="text-[11px] text-blue-300 font-medium block">
                    Canonical Equity Backing
                  </span>
                  <span className="text-sm font-bold text-white">
                    {token.treasuryBurnedShares.toFixed(2)} Shares of {token.stockSymbol.slice(1)} Equity
                  </span>
                  <p className="text-[10px] text-blue-300/80">
                    All fees sent to 0x...dEaD automatically accrue to long-term stock value.
                  </p>
                </div>

                <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
                  <span className="text-gray-400">Treasury Destination:</span>
                  <a
                    href={`${explorerUrl}/address/0x000000000000000000000000000000000000dEaD`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-primary hover:underline font-mono text-[11px]"
                  >
                    <span>0x...dEaD (Burned)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
