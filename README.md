# bulldotxyz (`bulldot.xyz`) 🐂

> **Simple, ultra-reliable DEX + Launchpad on Base focused on Coinbase tokenized stocks (B20 standard).**

Designed to run for years with near-zero ongoing maintenance, immutable security guarantees, and a frictionless Web2-friendly user experience.

---

## 🌟 Key Features

* **Coinbase Tokenized Stock Pairs (B20 Standard)**: Trade and launch community tokens exclusively paired with tokenized equities (e.g., `bCOIN`, `bNVDA`, `bAAPL`, `bTSLA`).
* **Multiplier-Aware Smart Contracts**: Handles corporate actions (stock splits / reverse splits) transparently: $1 \text{ Token} \neq 1 \text{ Share}$ permanently. Bonding curves and graduation thresholds denominate in canonical underlying shares.
* **Dual Launch Modes**:
  1. **Instant Uniswap v4 Pool**: For projects with upfront capital — seeds a v4 pool and permanently burns/locks the liquidity NFT.
  2. **Bonding Curve Fair Launch**: Zero upfront capital required. Users trade along a virtual curve until target liquidity is accumulated, then automatically migrates to a permanent Uniswap v4 pool.
* **Creator Fees & Redirection**: Flexible creator fee on every trade with optional automated redirect to a DAO, stock-holders, or a community treasury.
* **Zero-Admin / Autonomous**: Immutable contracts, no upgradeability backdoors, permissionless graduation, and no off-chain keeper dependencies.
* **Network Strategy**: Fully developed and tested on **Base Sepolia** (`84532`), with 100% config-driven deployment to **Base Mainnet** (`8453`).

---

## 🏗️ Architecture

```
                                  [bulldot.xyz Frontend]
                                (Next.js + Viem + Wagmi)
                                            │
                                            ▼
                                   [BulldotFactory]
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
          [Mode 1: Instant Pool]                      [Mode 2: Bonding Curve]
        - Mints Token                               - Mints 1B Total Supply
        - Deploys to Uniswap v4                     - Virtual Reserve Pricing
        - Burns Position NFT (Dead)                 - Multiplier-safe Accounting
                     │                                           │ (On 100% Target)
                     │                                           ▼
                     │                              [Uniswap v4 Migration]
                     │                              - Takes B20 + Token Reserve
                     │                              - Calls PoolManager Unlock
                     │                              - Burns LP Position
                     └─────────────────────┬─────────────────────┘
                                           ▼
                          [Uniswap v4 PoolManager (Base)]
```

---

## ⚙️ Networks & Configuration

| Parameter | Base Sepolia (Testnet) | Base Mainnet |
| :--- | :--- | :--- |
| **Chain ID** | `84532` | `8453` |
| **RPC URL** | `https://sepolia.base.org` | `https://mainnet.base.org` |
| **Block Explorer** | [sepolia.basescan.org](https://sepolia.basescan.org) | [basescan.org](https://basescan.org) |
| **Uniswap v4 PoolManager** | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` | `0x498581fF718922c3f8e6Ac1447f5c0994264F0F9` |
| **Uniswap v4 PositionManager** | `0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80` | `0x7C40c31F41609b77Ecdc5222E42b8e3a2B79A63f` |
| **Config File** | `contracts/config/84532.json` | `contracts/config/8453.json` |

---

## 🚀 Quick Start (Contracts)

### Prerequisites
* [Foundry](https://getfoundry.sh/) installed.
* Node.js v20+

### 1. Setup Environment
```bash
cd contracts
cp .env.example .env
# Fill in DEPLOYER_PRIVATE_KEY and BASESCAN_API_KEY
```

### 2. Compile & Test
```bash
forge build
forge test -vvv
```

### 3. Deploy to Base Sepolia
```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url base_sepolia --broadcast --verify
```

### 4. Deploy to Base Mainnet
```bash
forge script script/Deploy.s.sol:DeployScript --rpc-url base_mainnet --broadcast --verify
```

*No contract code modifications required between networks.*

---

## 🔒 Security Principles

1. **Immutable Contracts**: No proxy upgrades or admin keys capable of draining funds or changing curve formulas.
2. **Permanent Liquidity**: Uniswap v4 positions are routed to `0x000000000000000000000000000000000000dEaD` upon pool creation.
3. **Multiplier Split Invariance**: Internal calculations evaluate share values via `tokensToShares()`, preventing stock-split frontrunning or curve depletion.
4. **Transient Reentrancy Protection**: Utilizes EIP-1153 transient storage opcode (`TSTORE`/`TLOAD`) on Base for gas-efficient reentrancy prevention.

