# bulldotxyz (`bulldot.xyz`) 🐂

> **Autonomous Decentralized Exchange & Fair Launchpad on Base paired exclusively with Coinbase Tokenized Stocks (B20 Standard).**

bulldotxyz is an immutable, low-touch DeFi protocol built on Base. It bridges traditional equities with permissionless on-chain liquidity by enabling community tokens to pair directly with verified Coinbase tokenized stocks (`bCOIN`, `bNVDA`, `bAAPL`, `bTSLA`). Designed for high resilience, mathematical solvency, and minimal administrative oversight.

---

## 🏛️ System Architecture

```
                                  ┌──────────────────────────────┐
                                  │   bulldotxyz Web Platform    │
                                  │   (Next.js 14 + Viem + Wagmi)│
                                  └──────────────┬───────────────┘
                                                 │
                                                 ▼
                                  ┌──────────────────────────────┐
                                  │      BulldotRouter.sol       │
                                  │  - Seamless dual-mode routing│
                                  │  - Token/Curve auto-resolver │
                                  │  - Non-custodial refund safe │
                                  └───────┬──────────────┬───────┘
                                          │              │
                   ┌──────────────────────┘              └──────────────────────┐
                   ▼                                                            ▼
    ┌──────────────────────────────┐                             ┌──────────────────────────────┐
    │   BulldotBondingCurve.sol    │                             │       BulldotFactory.sol     │
    │ - Virtual AMM ($vB20 \cdot vTokens = k$)                   │ - Deploys tokens & curves    │
    │ - 50 Canonical Share Target  │                             │ - Verified B20 stock check   │
    │ - Anti-Sniper Max Wallet Cap │                             │ - Instant v4 Pool deployment │
    │ - Solvency-bounded payouts   │                             │ - Renounceable ownership     │
    └──────────────┬───────────────┘                             └──────────────┬───────────────┘
                   │ (Upon 50 Shares)                                           │
                   ▼                                                            │
    ┌──────────────────────────────┐                                            │
    │    Uniswap v4 Graduation     │                                            │
    │ - Initializes PoolManager    │                                            │
    │ - Mints 100% LP to 0x...dEaD ◄────────────────────────────────────────────┘
    └──────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │     BulldotFeeVault.sol      │
    │ - Multiplier-aware tracking  │
    │ - Optional Treasury Redirect │
    │ - Permissionless burn execution
    └──────────────────────────────┘
```

---

## 🌟 Core Protocol Mechanics

### 1. Dual Launch Modes
* **Instant Uniswap v4 Pool (Mode 1)**: For creators with initial capital. Deploys a fixed-supply token (1,000,000,000 supply) paired with a verified B20 stock token and irreversibly mints 100% of the position to `address(0x000000000000000000000000000000000000dEaD)`.
* **Fair Launch Bonding Curve (Mode 2)**: Zero upfront capital required. Tokens trade along an autonomous virtual AMM curve seeded with 30 virtual B20 tokens. Once 50 canonical equity shares are accumulated, the contract automatically migrates all liquidity into a permanent Uniswap v4 pool and locks LP positions to `0x...dEaD`.

### 2. Multiplier-Aware Equity Accounting (B20 Standard)
Coinbase tokenized stocks implement dynamic on-chain share multipliers where $1\text{ Token} \neq 1\text{ Share}$ over time due to corporate splits:
$$\text{Canonical Shares} = \text{tokensToShares}(\text{netB20}) = \frac{\text{netB20} \times 10^{18}}{\text{multiplier}}$$

* **Split Invariance**: Graduation thresholds and fee accounting track canonical shares rather than raw ERC-20 balances, ensuring that forward or reverse stock splits do not distort curve progress or graduation pricing.
* **Mathematical Solvency**: Payouts during user sells are strictly bounded by raw vault reserves:
  $$\text{Payout} = \min(\text{grossB20}, \text{availableB20})$$
  This eliminates reserve underflow risks across any corporate split scenario.

### 3. Autonomous Fee Vault & Stock Buybacks
* **Autonomous Collection**: Creator fees (capped at 2.5% max) accrue in `BulldotFeeVault` in both raw token units and normalized canonical shares.
* **Stock Treasury Redirection**: Creators can redirect 100% of fees to `0x000000000000000000000000000000000000dEaD` (Coinbase Stock Treasury), effectively converting protocol volume into equity buybacks.
* **Permissionless Burn Execution**: When fees are redirected to `0x...dEaD`, `feeVault.claimFees()` is completely permissionless. Any community member, bot, or keeper can trigger the burn transaction.
* **Manager Renunciation**: Creators can call `renounceTokenManager()` to permanently lock fee redirection to the stock treasury, preventing fee hijacking.

### 4. Anti-Sniper Fair Launch Controls
Creators can optionally configure a `maxWalletBps` limit (e.g., 2% = 16M tokens) active strictly during the bonding curve phase. The check deactivates automatically upon graduation to Uniswap v4.

---

## 🔒 Security Architecture & Invariants

| Invariant | Mathematical / Code Guarantee | Target Contract |
| :--- | :--- | :--- |
| **Non-Custodial Router Guarantee** | Router never holds balances. If a trade delivers less than `minAmountOut`, allowances are cleared, 100% of input capital is refunded to `msg.sender`, and the transaction reverts. | `BulldotRouter.sol` |
| **Permanent Liquidity Locking** | 100% of initial and migrated Uniswap v4 LP positions are minted directly to `0x...dEaD`. No withdrawal, decrease, or harvest functions exist. | `BulldotFactory.sol`, `BulldotBondingCurve.sol` |
| **Share Graduation Normalization** | Threshold checks evaluate underlying canonical equity shares, guaranteeing parity across forward/reverse stock splits. | `BulldotBondingCurve.sol` |
| **Graduation Excess Refund** | Any capital exceeding the 50-share graduation threshold is refunded upfront to `msg.sender` before assessing fees. | `BulldotBondingCurve.sol` |
| **Signature Replay Protection** | EIP-2612 `permit` verifies nonces, enforces canonical `s` values ($s \le \text{secp256k1n}/2$), and recomputes domain separators on chain ID changes. | `BulldotToken.sol` |
| **Zero-Admin Autonomy** | Factory ownership is renounceable via `renounceOwnership()`. The protocol has zero pauses, fee overrides, or custody backdoors. | `BulldotFactory.sol` |

---

## ⚙️ Network Configuration

All addresses and parameters are managed strictly via environment configuration:

| Parameter | Base Sepolia (Testnet) | Base Mainnet |
| :--- | :--- | :--- |
| **Chain ID** | `84532` | `8453` |
| **RPC Endpoint** | `https://sepolia.base.org` | `https://mainnet.base.org` |
| **Block Explorer** | [sepolia.basescan.org](https://sepolia.basescan.org) | [basescan.org](https://basescan.org) |
| **Uniswap v4 PoolManager** | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` | `0x498581fF718922c3f8e6Ac1447f5c0994264F0F9` |
| **Uniswap v4 PositionManager** | `0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80` | `0x7C40c31F41609b77Ecdc5222E42b8e3a2B79A63f` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| **Treasury Fee Recipient** | `0xc96147c68ca8e153e70B3bC4745b8d974bDd212A` | `address(0)` (Inactive) |
| **Treasury Fee Rate** | `0.10%` (10 bps, immutable $\le 0.1\%$ cap) | `0.00%` |
| **Config File** | `contracts/config/84532.json` | `contracts/config/8453.json` |

---

## 📄 License
MIT License. Open source and free for the Ethereum and Base community.
