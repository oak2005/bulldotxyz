'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Rocket,
  ArrowRightLeft,
  ShieldCheck,
  FileCode2,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  Lock,
  Flame,
  Building2,
  Globe,
} from 'lucide-react';
import { SpotlightCard, TactileLink, Reveal, snappySpring } from '../../components/MotionPrimitives';
import { BaseNetworkMark, UniswapMark, StockEquityBadge } from '../../components/BrandAssets';
import { CONTRACT_CONFIGS } from '../../config/contracts';
import { VERIFIED_B20_STOCKS } from '../../config/stocks';
import { TESTNET_TREASURY_ADDRESS } from '../../context/ProtocolContext';

type DocSection = 'overview' | 'launching' | 'swapping' | 'safety' | 'contracts';

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>('overview');
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const sepolia = CONTRACT_CONFIGS[84532];
  const explorer = sepolia.explorerUrl;

  const copyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 2000);
    } catch {}
  };

  const sections: { id: DocSection; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'How It Works', icon: BookOpen },
    { id: 'launching', label: 'Launch Modes', icon: Rocket },
    { id: 'swapping', label: 'ETH & Stock Swaps', icon: ArrowRightLeft },
    { id: 'safety', label: 'Fees & Safety', icon: ShieldCheck },
    { id: 'contracts', label: 'Live Contracts', icon: FileCode2 },
  ];

  const deployedRows = [
    { label: 'BulldotFactory (V2)', role: 'Token & Curve Launch Gateway', address: sepolia.factory },
    { label: 'BulldotRouter (V2)', role: 'Atomic ETH <-> Stock <-> Token Router', address: sepolia.router },
    { label: 'BulldotFeeVault (V2)', role: 'Non-Custodial Creator Reward Vault', address: sepolia.feeVault },
    { label: 'BulldotCurveDeployer (V2)', role: 'Bonding Curve Deployment Helper', address: sepolia.curveDeployer },
    { label: 'B20 Registry (Mock)', role: 'Verified B20 Equity Allowlist Oracle', address: sepolia.b20Registry },
    { label: 'Uniswap v4 PoolManager', role: 'Canonical Base Sepolia v4 Singleton', address: sepolia.poolManager },
    { label: 'Testnet Treasury (<=0.1%)', role: 'Base Sepolia Protocol Fee Recipient', address: TESTNET_TREASURY_ADDRESS },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header & Live Status */}
      <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-micro bg-[#0052FF]/15 text-[#7CA8FF] border border-[#0052FF]/35">
              Guide &amp; Reference
            </span>
            <span className="inline-flex items-center space-x-1.5 text-[11px] font-mono text-[#00E599]">
              <BaseNetworkMark size={13} />
              <span>Base Sepolia Live (84532)</span>
            </span>
            <span className="inline-flex items-center space-x-1 text-[11px] font-mono text-muted">
              <Globe className="w-3 h-3 text-[#7CA8FF]" strokeWidth={1.6} />
              <span>bulldot.xyz domain rollout in progress</span>
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white tracking-display">
            Understanding bulldotxyz
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            A straightforward guide to equity-backed token launches on Base, single-click ETH swaps through Uniswap v4, creator fee controls, and our verified contracts.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <TactileLink href="/launch" variant="emerald" className="px-4 py-2.5 text-xs space-x-1.5">
            <span>Launch a Token</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
          </TactileLink>
          <TactileLink href="/" variant="secondary" className="px-4 py-2.5 text-xs">
            Open Swap
          </TactileLink>
        </div>
      </Reveal>

      {/* Main Split Navigation + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 lg:sticky lg:top-24">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`relative px-3.5 py-2.5 rounded-xl text-xs font-medium text-left transition-colors whitespace-nowrap flex items-center space-x-2.5 ${
                  active ? 'text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="docs-nav-pill"
                    transition={snappySpring}
                    className="absolute inset-0 rounded-xl bg-[#141C27] border border-[#0052FF]/45 shadow-[0_0_20px_-6px_rgba(0,82,255,0.45)]"
                  />
                )}
                <Icon
                  className={`relative z-10 w-4 h-4 shrink-0 ${
                    active ? 'text-[#00E599]' : 'text-muted'
                  }`}
                  strokeWidth={1.6}
                />
                <span className="relative z-10">{sec.label}</span>
              </button>
            );
          })}
        </aside>

        <div className="lg:col-span-9 space-y-6">
          {activeSection === 'overview' && (
            <Reveal className="space-y-6">
              <SpotlightCard className="p-6 sm:p-8 space-y-5">
                <span className="font-mono text-[10px] uppercase tracking-micro text-[#00E599]">
                  01 / Overview
                </span>
                <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
                  Tokenized Equities as Base Liquidity Backing
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  Instead of pairing every new community market strictly with volatile gas tokens, <strong className="text-ink">bulldotxyz</strong> pairs every launched token with a verified <strong className="text-ink">Coinbase B20 tokenized stock</strong>. That keeps pool reserves anchored in real-world equity value while preserving open, permissionless trading on Base and Uniswap v4.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-2">
                    <div className="flex items-center space-x-2 text-ink font-semibold text-xs">
                      <Lock className="w-4 h-4 text-[#00E599]" strokeWidth={1.6} />
                      <span>Locked Liquidity From Block Zero</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Whether launched via an Instant pool or graduated from a bonding curve, 100% of Uniswap v4 LP liquidity locks permanently inside PoolManager with no withdrawal path.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-2">
                    <div className="flex items-center space-x-2 text-ink font-semibold text-xs">
                      <Building2 className="w-4 h-4 text-[#7CA8FF]" strokeWidth={1.6} />
                      <span>Aligned With Public Equities</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Every buy adds equity demand into the paired stock reserve, and creators can redirect swap fees straight into permanent equity burns on-chain.
                    </p>
                  </div>
                </div>
              </SpotlightCard>

              <SpotlightCard accent="emerald" className="p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-display text-base font-semibold text-white">
                    Supported Testnet B20 Equities
                  </h3>
                  <span className="text-[11px] font-mono text-[#00E599]">
                    Claim Free via Header Faucet
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {VERIFIED_B20_STOCKS.map((stock) => (
                    <div
                      key={stock.symbol}
                      className="p-3.5 rounded-xl bg-[#080B10] border border-white/[0.07] flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <StockEquityBadge symbol={stock.symbol} size="md" />
                        <div>
                          <div className="text-xs font-semibold text-white">{stock.symbol}</div>
                          <div className="text-[11px] text-muted">{stock.name}</div>
                        </div>
                      </div>
                      <a
                        href={`${explorer}/token/${stock.address[84532]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[11px] text-[#7CA8FF] hover:text-white flex items-center space-x-1"
                      >
                        <span>
                          {stock.address[84532].slice(0, 6)}...{stock.address[84532].slice(-4)}
                        </span>
                        <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
                      </a>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>
          )}

          {activeSection === 'launching' && (
            <Reveal>
              <SpotlightCard className="p-6 sm:p-8 space-y-6">
                <span className="font-mono text-[10px] uppercase tracking-micro text-[#7CA8FF]">
                  02 / Dual Launch Modes
                </span>
                <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
                  Two Ways to Deploy on Base
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  Every launched token has a fixed 1,000,000,000 supply with zero mint authority after deployment. Choose the launch path that fits your community:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-xl bg-[#080B10] border border-[#0052FF]/35 space-y-3">
                    <div className="flex items-center space-x-2 text-[#7CA8FF] font-display font-semibold text-base">
                      <Rocket className="w-4 h-4" strokeWidth={1.75} />
                      <span>Fair Launch Bonding Curve</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Launch with zero upfront capital. Community buyers fund liquidity along an automatic curve until 50 underlying shares accumulate, then the pool graduates seamlessly into permanent Uniswap v4 liquidity.
                    </p>
                    <ul className="space-y-1.5 text-[11px] text-ink/85 font-mono pt-1">
                      <li>• 0 upfront B20 required</li>
                      <li>• Optional anti-sniper wallet cap (1% or 2%)</li>
                      <li>• Cap lifts automatically after graduation</li>
                    </ul>
                  </div>

                  <div className="p-5 rounded-xl bg-[#080B10] border border-[#00E599]/35 space-y-3">
                    <div className="flex items-center space-x-2 text-[#00E599] font-display font-semibold text-base">
                      <Flame className="w-4 h-4" strokeWidth={1.75} />
                      <span>Instant Uniswap v4 Pool</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Seed initial B20 stock liquidity immediately upon creation. The entire 1B token supply and your stock deposit enter a 0.30% Uniswap v4 pool straight away and lock permanently.
                    </p>
                    <ul className="space-y-1.5 text-[11px] text-ink/85 font-mono pt-1">
                      <li>• Immediate Uniswap v4 price discovery</li>
                      <li>• 100% full-range LP permanently locked</li>
                      <li>• No max-wallet cap restriction</li>
                    </ul>
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          )}

          {activeSection === 'swapping' && (
            <Reveal>
              <SpotlightCard className="p-6 sm:p-8 space-y-6">
                <span className="font-mono text-[10px] uppercase tracking-micro text-[#00E599]">
                  03 / Swapping &amp; Routing
                </span>
                <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
                  Trade With Native ETH or Direct B20 Stocks
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  You can connect any EVM wallet configured for Base Sepolia and swap using Native ETH—no manual stock swapping needed first. Or toggle <strong className="text-ink">Direct Stock</strong> if you already hold B20 shares from the faucet.
                </p>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#080B10] border border-[#0052FF]/35 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>One-Transaction ETH Buy</span>
                      <span className="font-mono text-[#00E599] text-[11px]">Default Route</span>
                    </div>
                    <div className="font-mono text-xs text-muted flex flex-wrap items-center gap-2 pt-1">
                      <span className="px-2 py-1 rounded bg-[#141C27] text-white">Native ETH</span>
                      <span className="text-[#00E599]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-[#7CA8FF] inline-flex items-center gap-1">
                        <UniswapMark size={12} /> B20 Stock Pool
                      </span>
                      <span className="text-[#00E599]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-[#00E599]">
                        Token Pool
                      </span>
                      <span className="text-[#00E599]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-white">Your Wallet</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-[#00E599]/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>One-Transaction Sell Back to ETH</span>
                      <span className="font-mono text-[#7CA8FF] text-[11px]">Reverse Route</span>
                    </div>
                    <div className="font-mono text-xs text-muted flex flex-wrap items-center gap-2 pt-1">
                      <span className="px-2 py-1 rounded bg-[#141C27] text-white">Community Token</span>
                      <span className="text-[#7CA8FF]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-[#00E599]">
                        Paired Stock
                      </span>
                      <span className="text-[#7CA8FF]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-[#7CA8FF] inline-flex items-center gap-1">
                        <UniswapMark size={12} /> ETH Payout
                      </span>
                      <span className="text-[#7CA8FF]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-white">Native ETH</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#141C27]/70 border border-white/[0.07] text-xs text-muted leading-relaxed">
                  <strong className="text-ink">Slippage &amp; Refund Protection:</strong> If a trade would deliver less than your minimum output or pushes a bonding curve past its 50-share graduation target, excess funds are refunded automatically inside the same transaction.
                </div>
              </SpotlightCard>
            </Reveal>
          )}

          {activeSection === 'safety' && (
            <Reveal>
              <SpotlightCard className="p-6 sm:p-8 space-y-5">
                <span className="font-mono text-[10px] uppercase tracking-micro text-[#7CA8FF]">
                  04 / Fees &amp; Protections
                </span>
                <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
                  Built for Stock Splits, Transparent Fees &amp; Autonomy
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-1.5">
                    <div className="text-white font-semibold">Split-Safe Equity Math</div>
                    <p className="text-muted leading-relaxed">
                      If a company conducts a stock split, B20 multipliers adjust the token-per-share ratio on-chain. Curves measure progress in normalized shares so splits never trap funds or distort graduation.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-1.5">
                    <div className="text-white font-semibold">Non-Custodial Creator Vault (0–2.5%)</div>
                    <p className="text-muted leading-relaxed">
                      Creator swap fees accumulate exclusively for the token&apos;s designated recipient. Protocol owners have zero ability to freeze, skim, or claim creator fees.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-1.5">
                    <div className="text-white font-semibold">Stock Treasury Burn Option</div>
                    <p className="text-muted leading-relaxed">
                      Creators can route fees permanently to <span className="font-mono text-ink">0x...dEaD</span> and renounce manager rights from the Creator Hub, making equity buyback burns permissionless for everyone.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-1.5">
                    <div className="text-white font-semibold">Strict Protocol Cap (&le; 0.10%)</div>
                    <p className="text-muted leading-relaxed">
                      Base Sepolia applies a fixed 0.10% testnet treasury fee. Base Mainnet deploys paused with 0.00% protocol fee until official Coinbase B20 contracts launch on Base.
                    </p>
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          )}

          {activeSection === 'contracts' && (
            <Reveal>
              <SpotlightCard className="p-6 sm:p-8 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-micro text-[#00E599]">
                      05 / Live Contracts &amp; Domains
                    </span>
                    <h2 className="font-display text-2xl font-semibold text-white tracking-tight mt-0.5">
                      Verified Base Sepolia Deployment
                    </h2>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-[#0052FF]/15 border border-[#0052FF]/35 text-[11px] font-mono text-[#7CA8FF]">
                    Chain ID 84532 • Block #{sepolia.deploymentBlock.toString()}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#0052FF]/10 border border-[#0052FF]/30 text-xs text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-ink font-semibold block">Web Deployment Status</span>
                    <span>
                      Live testnet interface at{' '}
                      <a
                        href="https://web-oak14.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7CA8FF] underline font-mono"
                      >
                        web-oak14.vercel.app
                      </a>{' '}
                      while transitioning to primary domain <strong className="text-[#00E599]">bulldot.xyz</strong>.
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {deployedRows.map((row) => (
                    <div
                      key={row.label}
                      className="p-3.5 rounded-xl bg-[#080B10] border border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-semibold text-white">{row.label}</div>
                        <div className="text-[11px] text-muted">{row.role}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs text-ink break-all">{row.address}</span>
                        <button
                          onClick={() => copyAddress(row.address)}
                          className="p-1.5 rounded-lg bg-[#141C27] hover:bg-[#192331] text-muted hover:text-white transition-colors shrink-0"
                          title="Copy address"
                        >
                          {copiedAddr === row.address ? (
                            <Check className="w-3.5 h-3.5 text-[#00E599]" strokeWidth={2} />
                          ) : (
                            <Copy className="w-3.5 h-3.5" strokeWidth={1.6} />
                          )}
                        </button>
                        <a
                          href={`${explorer}/address/${row.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-[#141C27] hover:bg-[#192331] text-[#7CA8FF] hover:text-white transition-colors shrink-0"
                          title="Inspect on BaseScan"
                        >
                          <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.6} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  );
}
