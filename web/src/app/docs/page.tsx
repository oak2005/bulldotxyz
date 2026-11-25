'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  ArrowRightLeft,
  ShieldCheck,
  Building2,
  FileCode2,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  Lock,
  Layers,
} from 'lucide-react';
import { SpotlightCard, TactileLink, Reveal, snappySpring } from '../../components/MotionPrimitives';
import { BaseNetworkMark, UniswapMark, StockEquityBadge } from '../../components/BrandAssets';
import { CONTRACT_CONFIGS } from '../../config/contracts';
import { VERIFIED_B20_STOCKS } from '../../config/stocks';
import { TESTNET_TREASURY_ADDRESS } from '../../context/ProtocolContext';

type DocSection = 'overview' | 'routing' | 'math' | 'treasury' | 'contracts';

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>('overview');
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const sepolia = CONTRACT_CONFIGS[84532];
  const explorer = 'https://sepolia.basescan.org';

  const copyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 2000);
    } catch {}
  };

  const sections: { id: DocSection; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Architecture & Thesis', icon: BookOpen },
    { id: 'routing', label: '2-Hop ETH Routing', icon: ArrowRightLeft },
    { id: 'math', label: 'B20 Bonding Curve', icon: Layers },
    { id: 'treasury', label: 'Fees & Security', icon: ShieldCheck },
    { id: 'contracts', label: 'Live Contracts', icon: FileCode2 },
  ];

  const deployedRows = [
    { label: 'BulldotFactory', role: 'Token & Curve Deployment Gateway', address: sepolia.factory },
    { label: 'BulldotRouter', role: '2-Hop ETH <-> Stock <-> Meme Router', address: sepolia.router },
    { label: 'BulldotFeeVault', role: 'Non-Custodial Multiplier-Aware Fee Vault', address: sepolia.feeVault },
    { label: 'BulldotCurveDeployer', role: 'Stateless Bonding Curve Deployer', address: sepolia.curveDeployer },
    { label: 'MockB20Registry', role: 'Allowlisted Equity Verification Oracle', address: sepolia.b20Registry },
    { label: 'Uniswap v4 PoolManager', role: 'Canonical Base Sepolia v4 Singleton', address: sepolia.poolManager },
    { label: 'Testnet Treasury (<=0.1%)', role: 'Sepolia Protocol Fee Recipient', address: TESTNET_TREASURY_ADDRESS },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-micro bg-[#0052FF]/15 text-[#7CA8FF] border border-[#0052FF]/35">
              Protocol Specification
            </span>
            <span className="inline-flex items-center space-x-1.5 text-[11px] font-mono text-[#00E599]">
              <BaseNetworkMark size={13} />
              <span>Base Sepolia Active (84532)</span>
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white tracking-display">
            How bulldot.xyz Works
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            Technical reference covering our equity-backed bonding curve AMM, atomic Uniswap v4 ETH routing, split-invariant B20 accounting, and verified smart contracts on Base.
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
        {/* Sidebar / Mobile Scroll Tabs */}
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

        {/* Documentation Body */}
        <div className="lg:col-span-9 space-y-6">
          {activeSection === 'overview' && (
            <Reveal className="space-y-6">
              <SpotlightCard className="p-6 sm:p-8 space-y-5">
                <span className="font-mono text-[10px] uppercase tracking-micro text-[#00E599]">
                  01 / Protocol Thesis
                </span>
                <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
                  Why Pair Community Tokens With Tokenized Stocks?
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  Conventional launchpads pair meme tokens solely against volatile native ETH or idle stablecoins. When market risk-off cycles hit, liquidity drains out in a single direction. <strong className="text-ink">bulldot.xyz</strong> replaces pure speculative backing by enforcing that every deployed token on <strong className="text-ink">BulldotFactory</strong> pairs exclusively with verified <strong className="text-ink">Coinbase B20 tokenized equities</strong> (<span className="font-mono text-ink">bCOIN</span>, <span className="font-mono text-ink">bNVDA</span>, <span className="font-mono text-ink">bAAPL</span>, <span className="font-mono text-ink">bTSLA</span>).
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-2">
                    <div className="flex items-center space-x-2 text-ink font-semibold text-xs">
                      <Lock className="w-4 h-4 text-[#00E599]" strokeWidth={1.6} />
                      <span>Permanent Uniswap v4 Lock</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Every instant launch and every bonding curve that completes its 50-share target mints 100% of Uniswap v4 LP liquidity straight to <span className="font-mono text-ink">0x...dEaD</span> with zero withdrawal hooks.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-2">
                    <div className="flex items-center space-x-2 text-ink font-semibold text-xs">
                      <Building2 className="w-4 h-4 text-[#7CA8FF]" strokeWidth={1.6} />
                      <span>Equity Buyback Alignment</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Creators can route swap fees directly to <span className="font-mono text-ink">0x...dEaD</span> (Stock Treasury Burn) and lock management forever via <span className="font-mono text-ink">renounceTokenManager()</span>.
                    </p>
                  </div>
                </div>
              </SpotlightCard>

              <SpotlightCard accent="emerald" className="p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-display text-base font-semibold text-white">
                    Verified Base Sepolia Paired Equities
                  </h3>
                  <span className="text-[11px] font-mono text-[#00E599]">
                    B20 Standard • Split-Aware
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

          {activeSection === 'routing' && (
            <Reveal>
              <SpotlightCard className="p-6 sm:p-8 space-y-6">
                <span className="font-mono text-[10px] uppercase tracking-micro text-[#7CA8FF]">
                  02 / Atomic Settlement Pipeline
                </span>
                <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
                  Single-Transaction ETH &harr; Stock &harr; Token Swaps
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  Users do not need to acquire tokenized stocks manually before trading. <span className="font-mono text-ink">BulldotRouter.sol</span> integrates directly with Uniswap v4 <span className="font-mono text-ink">PoolManager</span> flash accounting (<span className="font-mono text-ink">unlockCallback</span>) to bridge Native ETH and B20 equities atomically in one transaction.
                </p>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#080B10] border border-[#0052FF]/35 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>Buying With Native ETH (Zero ETH Approval)</span>
                      <span className="font-mono text-[#00E599] text-[11px]">swapEthForTokens()</span>
                    </div>
                    <div className="font-mono text-xs text-muted flex flex-wrap items-center gap-2 pt-1">
                      <span className="px-2 py-1 rounded bg-[#141C27] text-white">Native ETH</span>
                      <span className="text-[#00E599]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-[#7CA8FF] inline-flex items-center gap-1">
                        <UniswapMark size={12} /> PoolManager (ETH/Stock)
                      </span>
                      <span className="text-[#00E599]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-[#00E599]">
                        BondingCurve / v4 Pool
                      </span>
                      <span className="text-[#00E599]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-white">User Wallet</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-[#00E599]/30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-white">
                      <span>Selling Tokens Back to Native ETH</span>
                      <span className="font-mono text-[#7CA8FF] text-[11px]">swapTokensForEth()</span>
                    </div>
                    <div className="font-mono text-xs text-muted flex flex-wrap items-center gap-2 pt-1">
                      <span className="px-2 py-1 rounded bg-[#141C27] text-white">Community Token</span>
                      <span className="text-[#7CA8FF]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-[#00E599]">
                        BondingCurve.sell()
                      </span>
                      <span className="text-[#7CA8FF]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-[#7CA8FF] inline-flex items-center gap-1">
                        <UniswapMark size={12} /> PoolManager.take(ETH)
                      </span>
                      <span className="text-[#7CA8FF]">&rarr;</span>
                      <span className="px-2 py-1 rounded bg-[#141C27] text-white">Native ETH</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#141C27]/70 border border-white/[0.07] text-xs text-muted leading-relaxed">
                  <strong className="text-ink">Non-Custodial Router Guarantee:</strong> <span className="font-mono text-ink">BulldotRouter</span> retains zero persistent token or ETH balances. Unused ETH settle change and bonding curve graduation cap overages refund directly to <span className="font-mono text-ink">msg.sender</span> in the same call.
                </div>
              </SpotlightCard>
            </Reveal>
          )}

          {activeSection === 'math' && (
            <Reveal>
              <SpotlightCard className="p-6 sm:p-8 space-y-5">
                <span className="font-mono text-[10px] uppercase tracking-micro text-[#00E599]">
                  03 / AMM &amp; Split-Invariant Accounting
                </span>
                <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
                  Bonding Curve &amp; B20 Share Normalization
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  Real-world corporate stock splits alter share multipliers over time, meaning <span className="font-mono text-ink">1 ERC-20 Token != 1 Underlying Share</span>. Every curve normalizes accumulated deposits into canonical shares via the paired stock&apos;s on-chain <span className="font-mono text-ink">tokensToShares()</span> oracle.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07]">
                    <span className="text-muted block">Total Supply</span>
                    <span className="font-mono text-lg font-semibold text-white mt-1 block">
                      1,000,000,000
                    </span>
                    <span className="text-[11px] text-muted">Fixed cap • No mint()</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07]">
                    <span className="text-muted block">Curve / LP Split</span>
                    <span className="font-mono text-lg font-semibold text-[#7CA8FF] mt-1 block">
                      800M / 200M
                    </span>
                    <span className="text-[11px] text-muted">200M reserved for v4 LP</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07]">
                    <span className="text-muted block">Graduation Target</span>
                    <span className="font-mono text-lg font-semibold text-[#00E599] mt-1 block">
                      50 Shares
                    </span>
                    <span className="text-[11px] text-muted">Normalized canonical equity</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.08] font-mono text-xs text-ink space-y-2">
                  <div>CanonicalShares = (netB20 * 1e18) / multiplier</div>
                  <div className="text-[#00E599]">SellPayout = min(grossB20, stock.balanceOf(curve))</div>
                  <div className="text-muted text-[11px] font-sans">
                    Excess capital above the 50-share graduation mark refunds upfront before assessing fees, and optional <span className="font-mono text-ink">maxWalletTokens</span> caps protect early curves from single-wallet cornering until graduation.
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          )}

          {activeSection === 'treasury' && (
            <Reveal>
              <SpotlightCard className="p-6 sm:p-8 space-y-5">
                <span className="font-mono text-[10px] uppercase tracking-micro text-[#7CA8FF]">
                  04 / Fee Vault &amp; Security Guarantees
                </span>
                <h2 className="font-display text-2xl font-semibold text-white tracking-tight">
                  Immutable Creator Rewards &amp; 0.10% Testnet Cap
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-1.5">
                    <div className="text-white font-semibold">Zero Admin Custody Over Vault Fees</div>
                    <p className="text-muted leading-relaxed">
                      <span className="font-mono text-ink">BulldotFeeVault.sol</span> holds fees solely for the token&apos;s designated <span className="font-mono text-ink">feeRecipient</span>. No factory owner or protocol multisig can freeze, skim, or redirect user creator rewards.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-1.5">
                    <div className="text-white font-semibold">Permissionless Stock Treasury Burn</div>
                    <p className="text-muted leading-relaxed">
                      When redirected to <span className="font-mono text-ink">0x...dEaD</span>, calling <span className="font-mono text-ink">claimFees(token, stock)</span> becomes completely permissionless so anyone can finalize equity burns on-chain.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-1.5">
                    <div className="text-white font-semibold">Hard-Capped Protocol Fee (&le; 0.10%)</div>
                    <p className="text-muted leading-relaxed">
                      Both <span className="font-mono text-ink">BulldotFactory</span> and <span className="font-mono text-ink">BulldotBondingCurve</span> enforce <span className="font-mono text-ink">MAX_PROTOCOL_FEE_BPS = 10</span> (0.10% maximum). On Base Sepolia it routes to <span className="font-mono text-[#00E599]">0xc961...212A</span>; Base Mainnet defaults to paused with <span className="font-mono text-ink">0 bps</span>.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#080B10] border border-white/[0.07] space-y-1.5">
                    <div className="text-white font-semibold">EIP-2612 &amp; Reentrancy Hardening</div>
                    <p className="text-muted leading-relaxed">
                      <span className="font-mono text-ink">BulldotToken</span> enforces low-order <span className="font-mono text-ink">s</span> signatures and dynamic domain separator recomputation. All router and AMM state transitions follow CEI under <span className="font-mono text-ink">nonReentrant</span> mutexes.
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
                      05 / On-Chain Registry
                    </span>
                    <h2 className="font-display text-2xl font-semibold text-white tracking-tight mt-0.5">
                      Verified Base Sepolia Contracts
                    </h2>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-[#0052FF]/15 border border-[#0052FF]/35 text-[11px] font-mono text-[#7CA8FF]">
                    Chain ID 84532 • Block #{sepolia.deploymentBlock.toString()}
                  </span>
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

