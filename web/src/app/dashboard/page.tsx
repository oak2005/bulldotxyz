'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { ShieldCheck, Coins, ArrowRightLeft, CheckCircle2, Building2 } from 'lucide-react';
import { VERIFIED_B20_STOCKS } from '../../config/stocks';

export default function DashboardPage() {
  const { isConnected, address } = useAccount();

  const [activeTab, setActiveTab] = useState<'METRICS' | 'REDIRECT'>('METRICS');
  const [selectedStock, setSelectedStock] = useState('bCOIN');
  const [newRecipient, setNewRecipient] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Mocked on-chain fee metrics
  const mockMetrics = {
    totalRawCollected: '1.425 bCOIN',
    totalSharesCollected: '1.425 Canonical Shares (1.00x Split Ratio)',
    claimableRaw: '0.850 bCOIN (~$265.62 USD)',
    currentRecipient: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x...',
  };

  const handleClaim = () => {
    setIsClaiming(true);
    setTimeout(() => {
      setIsClaiming(false);
      alert('Successfully claimed 0.850 bCOIN creator fees to your wallet!');
    }, 1200);
  };

  const handleRedirect = () => {
    setIsRedirecting(true);
    setTimeout(() => {
      setIsRedirecting(false);
      alert(`Fees successfully redirected to: ${newRecipient || 'Coinbase Stock Treasury'}!`);
      setNewRecipient('');
    }, 1200);
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
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'METRICS'
              ? 'bg-surface text-white border border-border'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Fee Earnings & Claims
        </button>
        <button
          onClick={() => setActiveTab('REDIRECT')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'REDIRECT'
              ? 'bg-surface text-white border border-border'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Fee Redirection Manager
        </button>
      </div>

      {activeTab === 'METRICS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Collected */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
            <span className="text-xs text-gray-400 block">Total Lifetime B20 Fees</span>
            <div className="text-2xl font-bold text-white">{mockMetrics.totalRawCollected}</div>
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-primary" />
              {mockMetrics.totalSharesCollected}
            </p>
          </div>

          {/* Card 2: Current Recipient */}
          <div className="bg-surface border border-border rounded-xl p-5 space-y-2">
            <span className="text-xs text-gray-400 block">Active Fee Recipient</span>
            <div className="text-xl font-mono font-bold text-white">{mockMetrics.currentRecipient}</div>
            <p className="text-[11px] text-success flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Autonomous on-chain vault routing
            </p>
          </div>

          {/* Card 3: Claimable Balance & Action */}
          <div className="bg-surface border border-primary/40 rounded-xl p-5 space-y-3">
            <span className="text-xs text-primary font-semibold block">Available to Claim</span>
            <div className="text-xl font-bold text-white">{mockMetrics.claimableRaw}</div>

            <button
              disabled={!isConnected || isClaiming}
              onClick={handleClaim}
              className="w-full py-2 bg-primary hover:bg-primary-hover disabled:bg-surface-hover text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {isClaiming ? 'Claiming from Vault...' : 'Claim B20 Stock Fees'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'REDIRECT' && (
        <div className="bg-surface border border-border rounded-xl p-6 max-w-xl space-y-5">
          <div>
            <h2 className="text-base font-bold text-white">Redirect Creator Fees</h2>
            <p className="text-xs text-gray-400 mt-1">
              Route trading fees to a Coinbase stock treasury (buyback and dividend), a DAO multisig, or token holders.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-xs text-gray-400 block mb-1">Select Preset:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setNewRecipient('0x000000000000000000000000000000000000dEaD')}
                  className="p-2.5 rounded-lg border border-border bg-background/40 hover:border-primary text-left text-gray-200"
                >
                  <Building2 className="w-4 h-4 text-primary mb-1" />
                  <span className="font-semibold block">Stock Treasury</span>
                  <span className="text-[10px] text-gray-400">Burns fees as stock dividend</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewRecipient(address || '')}
                  className="p-2.5 rounded-lg border border-border bg-background/40 hover:border-primary text-left text-gray-200"
                >
                  <ArrowRightLeft className="w-4 h-4 text-warning mb-1" />
                  <span className="font-semibold block">My Wallet</span>
                  <span className="text-[10px] text-gray-400">Reset to creator address</span>
                </button>
              </div>
            </div>

            <div>
              <span className="text-xs text-gray-400 block mb-1">Or Enter Custom Destination Address:</span>
              <input
                type="text"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
              />
            </div>

            <button
              disabled={!isConnected || !newRecipient || isRedirecting}
              onClick={handleRedirect}
              className="w-full py-3 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:text-gray-500 text-white rounded-xl text-xs font-bold transition-colors"
            >
              {isRedirecting ? 'Updating Vault...' : 'Confirm Redirection'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

