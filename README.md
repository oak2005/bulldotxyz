# bulldotxyz

**Stock-backed decentralized exchange and token launchpad on Base, paired with Coinbase Tokenized Stocks (B20 standard).**

---

## Status

> **Contracts:** Deployed and verified with end-to-end unit and Base Sepolia fork tests (`38 / 38` passing).
> **Web App (Temporary):** [https://web-oak14.vercel.app](https://web-oak14.vercel.app)
> **Primary Domain:** `bulldot.xyz` (acquired — domain cutover from the temporary Vercel URL is in progress).
> **Network Scope:** Live on **Base Sepolia Testnet (`84532`)**; **Base Mainnet (`8453`)** configuration is ready and paused pending official Coinbase B20 asset deployment.

---

## Why bulldotxyz

Most on-chain token launchpads pair new markets solely against native ETH or idle stablecoins. Base needed a launchpad primitive built directly around productive on-chain equity assets:

- **Equity-Backed Liquidity Depth:** Every market launched on `BulldotFactory` must pair exclusively with an allowlisted Coinbase B20 tokenized stock (`bCOIN`, `bNVDA`, `bAAPL`, `bTSLA`), anchoring pool reserves in recognizable real-world equities rather than purely circular token emissions.
- **Native ETH Onboarding Without Friction:** Traders do not need to acquire B20 stocks beforehand. `BulldotRouter` settles single-transaction two-hop swaps (`ETH <-> B20 Stock <-> Token`) through Uniswap v4 `PoolManager`.
- **Corporate-Action Resilience:** Tokenized equities undergo stock splits that change token-to-share ratios over time. Bonding curves and fee vaults account in canonical shares via `tokensToShares()`, ensuring splits never break graduation targets, pricing continuity, or sell solvency.
- **Minimal, Verifiable Governance:** Permanent Uniswap v4 liquidity locking, optional renounceable token fee management, and renounceable factory ownership keep deployed markets self-sustaining with low maintenance overhead.

---

## Core Features

- **Dual Launch Modes:**
  - **Fair Launch Bonding Curve:** Zero upfront capital required. Starts with `30` virtual B20 reserve, allocates `800M` tokens to the curve (`200M` reserved for LP out of a fixed `1B` supply), and automatically migrates to Uniswap v4 once `50` canonical shares accumulate.
  - **Instant Uniswap v4 Pool:** Deploys a fixed-supply `1B` ERC-20 token paired with an initial B20 equity deposit, initializes a `0.30%` pool in Uniswap v4 `PoolManager`, and locks `100%` of full-range LP liquidity permanently.
- **Atomic 2-Hop ETH Routing:** Buy or sell any curve or graduated/instant Uniswap v4 pool in a single transaction with Native ETH (`swapEthForTokens` / `swapTokensForEth`) or swap directly with B20 stocks (`swapB20ForTokens` / `swapTokensForB20`).
- **Multiplier-Aware B20 Accounting:** Normalizes deposits using each B20 stock's `tokensToShares()` multiplier oracle (`canonicalShares = (netB20 * 1e18) / multiplier`) and caps sell payouts by available contract reserves (`min(grossB20, stock.balanceOf(curve))`).
- **Autonomous Fee Vault & Treasury Burn Redirect:** Creator fees (up to `2.5%` / `250 bps`) accrue inside `BulldotFeeVault` with zero admin custody. Token managers can redirect `100%` of fees to `0x000000000000000000000000000000000000dEaD` (making fee settlement permissionless) and permanently lock fee routing via `renounceTokenManager()`.
- **Temporary Anti-Sniper Controls:** Optional `maxWalletBps` limit (e.g., `2%` = `16M` tokens) during bonding-curve trading that automatically deactivates upon Uniswap v4 graduation.
- **Renounceable Protocol Ownership:** `BulldotFactory` and `BulldotRouter` support permanent `renounceOwnership()`, leaving core launch and swap execution fully immutable.

---

## Architecture Overview

```text
                        ┌────────────────────────────────────┐
                        │       bulldotxyz Web Client        │
                        │  Next.js 14 • Wagmi • Viem • RK    │
                        └──────────────────┬─────────────────┘
                                           │
                                           ▼
                        ┌────────────────────────────────────┐
                        │          BulldotRouter.sol         │
                        │ - Single-tx ETH <-> Stock <-> Meme │
                        │ - Curve / v4 pool auto-resolution  │
                        │ - Non-custodial refund guarantee   │
                        └─────────┬─────────────────┬────────┘
                                  │                 │
           ┌──────────────────────┘                 └──────────────────────┐
           ▼                                                               ▼
┌──────────────────────────────────┐                            ┌──────────────────────────────────┐
│     BulldotBondingCurve.sol      │                            │       BulldotFactory.sol         │
│ - Virtual AMM (vB20 * vTok = k)  │◄─── deploys via ───────────│ - Verified B20 allowlist check   │
│ - 50 canonical shares graduation │     CurveDeployer          │ - Fair Curve & Instant v4 modes  │
│ - Expiring maxWalletBps cap      │                            │ - Records tokenToCurve & Stock   │
└─────────────────┬────────────────┘                            └────────────────┬─────────────────┘
                  │ (At 50 Shares)                                               │ (Instant Launch)
                  ▼                                                              ▼
       ┌───────────────────────────────────────────────────────────────────────────────────┐
       │                        Uniswap v4 PoolManager (Singleton)                         │
       │ - Full-range LP locked directly via unlockCallback (no withdrawal code path)      │
       │ - Remainder rounding dust (<0.1%) forwarded to 0x...dEaD                          │
       └─────────────────────────────────────────┬─────────────────────────────────────────┘
                                                 │
                                                 ▼
                               ┌──────────────────────────────────┐
                               │       BulldotFeeVault.sol        │
                               │ - Non-custodial fee accrual      │
                               │ - Multiplier-aware share metrics │
                               │ - Permissionless 0x...dEaD burns │
                               └──────────────────────────────────┘
```

---

## Security Invariants

| Invariant | Guarantee | Contract |
| :--- | :--- | :--- |
| **Non-Custodial Router** | Router retains zero ETH or token balances across swaps; unused ETH settle change and graduation excess refund to `msg.sender` in the same call. | `BulldotRouter.sol` |
| **Permanent Liquidity Lock** | `100%` of full-range Uniswap v4 LP added by instant launches and curve graduations is held in non-withdrawable callback contracts (`unlockCallback` permits positive delta only; zero decrease/take functions exist). Rounding dust (`<0.1%`) goes to `0x...dEaD`. | `BulldotFactory.sol`, `BulldotBondingCurve.sol` |
| **Split-Invariant Thresholds** | Curve graduation (`50` shares) and Fee Vault share metrics normalize raw token amounts via the B20 `tokensToShares()` oracle, while sell payouts remain bounded by raw B20 balance. | `BulldotBondingCurve.sol`, `BulldotFeeVault.sol` |
| **Hard-Capped Fees** | Creator fee is capped at `2.50%` (`250 bps`); protocol treasury fee is hard-capped at `0.10%` (`10 bps` on Base Sepolia, `0 bps` on Base Mainnet). | `BulldotFactory.sol`, `BulldotBondingCurve.sol` |
| **Zero-Custody Fee Vault** | Protocol owners cannot seize, pause, or redirect creator rewards stored in `BulldotFeeVault`. | `BulldotFeeVault.sol` |
| **EIP-2612 Hardening & Reentrancy** | Token permits enforce canonical low-`s` signatures (`s <= secp256k1n/2`) and dynamic chain ID domain separators; state transitions use `nonReentrant` CEI guards. | `BulldotToken.sol`, All Core Contracts |

---

## Network Configuration

| Parameter | Base Sepolia (Testnet) | Base Mainnet |
| :--- | :--- | :--- |
| **Chain ID** | `84532` | `8453` |
| **Primary RPC** | `https://base-sepolia-rpc.publicnode.com` (`https://sepolia.base.org`) | `https://base-rpc.publicnode.com` (`https://mainnet.base.org`) |
| **Explorer** | [sepolia.basescan.org](https://sepolia.basescan.org) | [basescan.org](https://basescan.org) |
| **Status** | **Live (V2 Contracts Deployed)** | **Paused** (Pending Official B20 Assets) |
| **Protocol Treasury Fee** | `0.10%` (`10 bps` max) -> `0xc96147c68ca8e153e70B3bC4745b8d974bDd212A` | `0.00%` (`0 bps`) |
| **Uniswap v4 `PoolManager`** | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` | `0x498581fF718922c3f8e6Ac1447f5c0994264F0F9` |
| **Uniswap v4 `PositionManager`** | `0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80` | `0x7C40c31F41609b77Ecdc5222E42b8e3a2B79A63f` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| **BulldotFactory (V2)** | `0xE7bFFa9D74bDA7682958106C3FB7F1877bA8716E` | Pending Mainnet Rollout |
| **BulldotRouter (V2)** | `0xBffB230B4a28F961B44A71f5791E8A4aE5c6e8fc` | Pending Mainnet Rollout |
| **BulldotFeeVault (V2)** | `0xA323f48B06d0d49d12b156587Dfd3C8A9E224B78` | Pending Mainnet Rollout |
| **BulldotCurveDeployer (V2)** | `0x63Fa79A5FD2bf6fC53f12689ED82992c4c516Ba0` | Pending Mainnet Rollout |
| **B20 Registry (Mock Oracle)** | `0x098C0d1E4d7C8713EF1d92B2D3c67Cc923634C87` | Pending Mainnet Rollout |
| **Config File** | [contracts/config/84532.json](contracts/config/84532.json) | [contracts/config/8453.json](contracts/config/8453.json) |

### Base Sepolia Testnet B20 Tokens
- `bCOIN`: `0xB91fcC29d586E2F8326d4E956160f3FDf289d1c5`
- `bNVDA`: `0x1ad0e455458a67B91aae2d4C6cc9EF1CCc493EA5`
- `bAAPL`: `0xC31f5a66b19EbD0039fd0e3Ad31E6D0c57b017D2`
- `bTSLA`: `0xa855bBe14a6b67487717cCB0E0cFa3A0fbEe9007`

---

## Getting Started

### Prerequisites
- [Foundry](https://getfoundry.sh/) (`forge`, `cast`)
- Node.js `v20+` and `npm`

### 1. Smart Contracts (`contracts/`)
```bash
cd contracts
forge build --sizes
BASE_SEPOLIA_RPC_URL="https://base-sepolia-rpc.publicnode.com" forge test -vv
```
PowerShell equivalent:
```powershell
cd contracts
$env:BASE_SEPOLIA_RPC_URL="https://base-sepolia-rpc.publicnode.com"
forge build --sizes
forge test -vv
```
Suite coverage (`38 / 38` tests across 5 suites): `BulldotFactory.t.sol`, `BulldotBondingCurve.t.sol`, `BulldotRouter.t.sol`, `BulldotFeeSystem.t.sol`, and live Uniswap v4 fork tests in `BaseSepoliaFork.t.sol`.

### 2. Web Application (`web/`)
```bash
cd web
npm install
npm run dev
```
Production verification:
```bash
cd web
npm run build
```

---

## Deployment Notes

- **Base Sepolia V2 Deployment:** Core contracts (`Factory`, `CurveDeployer`, `FeeVault`, `Router`) are live at block `64836324` (`UpgradeProtocolV2.s.sol`). `ETH / B20` Uniswap v4 routing pools are initialized on the `0.05%` tier (`fee = 500`, `tickSpacing = 10`) while launched `Token / B20` pools use the standard `0.30%` tier (`fee = 3000`, `tickSpacing = 60`).
- **Frontend Hosting:** Hosted on Vercel with root directory `web/` (`https://web-oak14.vercel.app`), optionally configured with `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for production WalletConnect relay quotas. DNS cutover to **`bulldot.xyz`** is in progress.
- **Mainnet Transition:** `contracts/config/8453.json` holds canonical Base Mainnet Uniswap v4 `PoolManager` / `Permit2` coordinates with protocol fees disabled (`0 bps`). Once official Coinbase B20 stock addresses and `b20Registry` are configured, deploy with `contracts/script/Deploy.s.sol` and update `web/src/config/contracts.ts` and `web/src/config/stocks.ts`.

---

## License

MIT License. Open source and free for the Ethereum and Base community.
