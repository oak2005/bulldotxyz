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
| **Config File** | `contracts/config/84532.json` | `contracts/config/8453.json` |

---

## 🛠️ Smart Contracts & Local Testing

### Prerequisites
* [Foundry](https://getfoundry.sh/) (`forge`, `cast`, `anvil`)
* Node.js v20+

### Build & Run Tests
```bash
cd contracts

# Compile all contracts
forge build

# Execute full test suite (32 unit & fork tests)
forge test -vvv
```

### Test Suite Summary
```text
Ran 5 test suites:
- test/BulldotFactory.t.sol: 10 passed, 0 failed
- test/BulldotBondingCurve.t.sol: 7 passed, 0 failed
- test/BulldotRouter.t.sol: 6 passed, 0 failed
- test/BulldotFeeSystem.t.sol: 6 passed, 0 failed
- test/BaseSepoliaFork.t.sol: 3 passed, 0 failed

Total: 32 tests passed; 0 failed; 0 skipped
```

### Deploy to Base Sepolia
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url base_sepolia \
  --broadcast \
  --verify
```

---

## 💻 Frontend Application (Next.js 14)

The web client is built with Next.js 14 (App Router), Tailwind CSS, Wagmi v2, Viem, and RainbowKit.

### Local Development
```bash
cd web

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build Verification
```bash
npm run build
```

---

## 🌐 Deploying to Vercel & Connecting Custom Domain (`bulldot.xyz`)

Follow these steps to host the frontend on Vercel with your custom domain:

### Step 1: Import Repository into Vercel
1. Log in to [vercel.com](https://vercel.com) with your GitHub account.
2. Click **"Add New..."** $\rightarrow$ **"Project"**.
3. Select your repository: `bulldotxyz` (or `oak2005/bulldotxyz`).

### Step 2: Configure Project Settings
In the Vercel project configuration screen:
* **Framework Preset**: Next.js (auto-detected).
* **Root Directory**: Click **Edit** and set to `web`.
* **Build Command**: `next build` (default).
* **Output Directory**: `.next` (default).
* **Install Command**: `npm install` (default).

### Step 3: Configure Environment Variables
Under the **Environment Variables** section, add:
* `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: Your WalletConnect Cloud Project ID (get one free at [cloud.reown.com](https://cloud.reown.com)).
* `NEXT_PUBLIC_DEFAULT_CHAIN_ID`: `84532` (for Base Sepolia testnet) or `8453` (for Base Mainnet).

Click **Deploy**.

### Step 4: Connect Your Domain (`bulldot.xyz`)
1. In the Vercel dashboard for your project, navigate to **Settings** $\rightarrow$ **Domains**.
2. Enter `bulldot.xyz` and click **Add**.
3. Vercel will prompt you to add both `bulldot.xyz` and `www.bulldot.xyz`. Select **"Add bulldot.xyz and redirect www.bulldot.xyz to it"**.

### Step 5: Update DNS Records at Your Domain Registrar (Namecheap, GoDaddy, Cloudflare, etc.)
Log in to your DNS provider and add the following records:

| Type | Name / Host | Value / Target | TTL |
| :--- | :--- | :--- | :--- |
| **A Record** | `@` | `76.76.21.21` | Automatic / 300 |
| **CNAME** | `www` | `cname.vercel-dns.com.` | Automatic / 300 |

*Note: DNS propagation typically takes between 2 to 30 minutes. Vercel will automatically generate and provision a free Let's Encrypt SSL/TLS certificate once records resolve.*

### Step 6: Live Testing Checklist
Once deployed:
1. Visit `https://bulldot.xyz`.
2. Connect your wallet (Coinbase Wallet, MetaMask, or Rainbow) on Base Sepolia.
3. Test swapping between mock `bCOIN` and community tokens on the **Trade** page.
4. Test deploying a bonding curve or instant pool on the **Launch** page.
5. Inspect fee claims and stock treasury redirection on the **Creator Hub**.

---

## 📄 License
MIT License. Open source and free for the Ethereum and Base community.
