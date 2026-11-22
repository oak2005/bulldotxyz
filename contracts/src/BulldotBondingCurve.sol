// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IB20Stock} from "./interfaces/IB20Stock.sol";
import {BulldotToken} from "./BulldotToken.sol";
import {BulldotFeeVault} from "./BulldotFeeVault.sol";
import {IBulldotBondingCurve} from "./interfaces/IBulldotBondingCurve.sol";
import {PoolKey, PoolId, PoolIdLibrary, IPoolManager, IPositionManager} from "./interfaces/IUniswapV4Minimal.sol";

/**
 * @notice SECURITY NOTES:
 * - BulldotBondingCurve is an autonomous, multiplier-aware AMM paired with Coinbase B20 tokenized stocks.
 * - AMM SOLVENCY GUARANTEE:
 *   Virtual reserves are denominated in native traded asset units (raw B20 tokens and Meme tokens)
 *   satisfying (vB20 * vTokens = k). User sell payouts are mathematically bounded by actual contract B20 balance.
 * - ANTI-SNIPER FAIR LAUNCH CAP:
 *   Includes optional `maxWalletTokens` restriction during the bonding curve phase to prevent single wallets
 *   from cornering supply. Automatically deactivates upon Uniswap v4 graduation.
 * - SHARE NORMALIZATION (1 Token != 1 Share):
 *   Graduation threshold (e.g. 50 shares) is denominated in canonical underlying shares via `tokensToShares()`.
 *   When stock splits adjust the multiplier, the target graduation adapts dynamically without distorting AMM pricing.
 * - CAPPED GRADUATION & FAIR FEE REFUND:
 *   If a final trade exceeds the graduation threshold, the excess B20 is refunded upfront, and fees are
 *   strictly assessed only against the consumed capital.
 * - RESILIENT FEE ROUTING:
 *   Creator fees route into BulldotFeeVault. If the fee recipient is unpayable or blocked, fees buffer safely
 *   without bricking the trade.
 * - PERMANENT UNISWAP V4 LIQUIDITY LOCK:
 *   Upon graduation, liquidity is deployed to Uniswap v4 via PositionManager and permanently minted to
 *   `0x000000000000000000000000000000000000dEaD`.
 */
contract BulldotBondingCurve is IBulldotBondingCurve {
    using PoolIdLibrary for PoolKey;

    // --- Custom Errors ---
    error CurveAlreadyGraduated();
    error CurveNotGraduated();
    error ZeroInput();
    error ZeroAddress();
    error SlippageExceeded();
    error InsufficientReserve();
    error TargetNotReached();
    error TransferFailed();
    error Reentrancy();
    error CreatorFeeExceedsLimit();

    // --- Immutables & Config ---
    address public immutable override token;
    address public immutable override b20Stock;
    address public immutable override creator;
    address public immutable protocolFeeRecipient;
    BulldotFeeVault public immutable feeVault;
    address public override feeRecipient;

    uint256 public immutable override creatorFeeBps;
    uint256 public immutable protocolFeeBps;
    uint256 public immutable override targetShares;
    uint256 public immutable override maxWalletTokens;

    // --- Uniswap v4 Constants ---
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;
    int24 internal constant TICK_LOWER = -887220;
    int24 internal constant TICK_UPPER = 887220;
    uint24 public constant DEFAULT_POOL_FEE = 3000;                  // 0.30% Uniswap v4 tier
    int24 public constant DEFAULT_TICK_SPACING = 60;
    address public constant PERMANENT_DEAD = address(0x000000000000000000000000000000000000dEaD);

    // --- Curve Constants ---
    uint256 public constant VIRTUAL_B20 = 30 * 1e18;                 // 30 virtual B20
    uint256 public constant TOTAL_CURVE_TOKENS = 800_000_000 * 1e18; // 800M tokens available to curve
    uint256 public constant MIGRATION_TOKENS = 200_000_000 * 1e18;   // 200M reserved for Uniswap v4 LP
    uint256 public constant VIRTUAL_TOKENS = 1_073_000_000 * 1e18;

    // --- State Variables ---
    uint256 public override virtualSharesReserve; // Virtual B20 reserve (named for interface compatibility)
    uint256 public override virtualTokenReserve;
    uint256 public totalB20Deposited;
    bool public override isGraduated;

    // Cumulative on-chain fee metrics
    uint256 public totalCreatorFeesCollectedRaw;
    uint256 public totalCreatorFeesCollectedShares;

    // Uniswap v4 Coordinates
    address public immutable poolManager;
    address public immutable positionManager;

    // Reentrancy Guard
    uint256 private _status = 1;
    modifier nonReentrant() {
        if (_status != 1) revert Reentrancy();
        _status = 2;
        _;
        _status = 1;
    }

    constructor(
        address _token,
        address _b20Stock,
        address _creator,
        address _feeRecipient,
        address _protocolFeeRecipient,
        address _feeVault,
        uint256 _creatorFeeBps,
        uint256 _protocolFeeBps,
        uint256 _targetShares,
        uint256 _maxWalletBps,
        address _poolManager,
        address _positionManager
    ) {
        if (_creatorFeeBps > 250) revert CreatorFeeExceedsLimit();
        if (_b20Stock == address(0) || _creator == address(0)) revert ZeroAddress();

        token = _token;
        b20Stock = _b20Stock;
        creator = _creator;
        feeRecipient = _feeRecipient == address(0) ? _creator : _feeRecipient;
        protocolFeeRecipient = _protocolFeeRecipient;
        feeVault = BulldotFeeVault(_feeVault);
        creatorFeeBps = _creatorFeeBps;
        protocolFeeBps = _protocolFeeBps;
        targetShares = _targetShares;
        maxWalletTokens = _maxWalletBps > 0 ? (TOTAL_CURVE_TOKENS * _maxWalletBps) / 10_000 : 0;

        poolManager = _poolManager;
        positionManager = _positionManager;

        virtualSharesReserve = VIRTUAL_B20;
        virtualTokenReserve = VIRTUAL_TOKENS;
    }

    /**
     * @notice Canonical shares accumulated towards graduation.
     */
    function totalSharesAccumulated() public view override returns (uint256) {
        if (totalB20Deposited == 0) return 0;
        try IB20Stock(b20Stock).tokensToShares(totalB20Deposited) returns (uint256 shares) {
            return shares;
        } catch {
            return totalB20Deposited;
        }
    }

    /**
     * @notice Allows creator to update fee recipient or redirect to a stock treasury / DAO.
     */
    function setFeeRecipient(address newRecipient) external {
        if (msg.sender != creator) revert Reentrancy();
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;

        if (address(feeVault) != address(0)) {
            try feeVault.redirectFeeRecipient(token, newRecipient) {} catch {}
        }
    }

    /**
     * @notice Simulates buy output and fees without state modification.
     */
    function getAmountOutForBuy(uint256 b20AmountIn)
        external
        view
        override
        returns (
            uint256 tokensOut,
            uint256 effectiveB20In,
            uint256 refundB20,
            uint256 fee
        )
    {
        if (isGraduated || b20AmountIn == 0) return (0, 0, 0, 0);

        uint256 currentShares = totalSharesAccumulated();
        uint256 remainingShares = targetShares > currentShares ? targetShares - currentShares : 0;

        effectiveB20In = b20AmountIn;

        if (remainingShares > 0) {
            uint256 maxNetB20Allowed = IB20Stock(b20Stock).sharesToTokens(remainingShares);
            uint256 totalFeeBps = creatorFeeBps + protocolFeeBps;
            uint256 maxGrossB20 = totalFeeBps < 10_000
                ? (maxNetB20Allowed * 10_000 + (10_000 - totalFeeBps - 1)) / (10_000 - totalFeeBps)
                : maxNetB20Allowed;

            if (b20AmountIn > maxGrossB20) {
                effectiveB20In = maxGrossB20;
                refundB20 = b20AmountIn - maxGrossB20;
            }
        }

        uint256 creatorFee = (effectiveB20In * creatorFeeBps) / 10_000;
        uint256 protocolFee = (effectiveB20In * protocolFeeBps) / 10_000;
        fee = creatorFee + protocolFee;
        uint256 netB20 = effectiveB20In - fee;

        if (netB20 == 0) return (0, effectiveB20In, refundB20, fee);

        uint256 k = virtualSharesReserve * virtualTokenReserve;
        uint256 newVirtualB20 = virtualSharesReserve + netB20;
        uint256 newVirtualTokens = k / newVirtualB20;
        tokensOut = virtualTokenReserve - newVirtualTokens;
    }

    /**
     * @notice Simulates sell output and fees without state modification.
     */
    function getAmountOutForSell(uint256 tokenAmountIn)
        external
        view
        override
        returns (uint256 b20Out, uint256 fee)
    {
        if (isGraduated || tokenAmountIn == 0) return (0, 0);

        uint256 k = virtualSharesReserve * virtualTokenReserve;
        uint256 newVirtualTokens = virtualTokenReserve + tokenAmountIn;
        uint256 newVirtualB20 = k / newVirtualTokens;
        uint256 grossB20 = virtualSharesReserve - newVirtualB20;

        uint256 availableB20 = IB20Stock(b20Stock).balanceOf(address(this));
        if (grossB20 > availableB20) {
            grossB20 = availableB20;
        }

        uint256 creatorFee = (grossB20 * creatorFeeBps) / 10_000;
        uint256 protocolFee = (grossB20 * protocolFeeBps) / 10_000;
        fee = creatorFee + protocolFee;
        b20Out = grossB20 > fee ? grossB20 - fee : 0;
    }

    /**
     * @notice Returns comprehensive pool liquidity and reserve metrics.
     */
    function getPoolLiquidity()
        external
        view
        override
        returns (
            uint256 rawB20Balance,
            uint256 tokenBalance,
            uint256 virtualB20,
            uint256 virtualTokens,
            uint256 sharesAccumulated,
            uint256 targetCanonicalShares,
            bool graduated
        )
    {
        rawB20Balance = IB20Stock(b20Stock).balanceOf(address(this));
        tokenBalance = BulldotToken(token).balanceOf(address(this));
        virtualB20 = virtualSharesReserve;
        virtualTokens = virtualTokenReserve;
        sharesAccumulated = totalSharesAccumulated();
        targetCanonicalShares = targetShares;
        graduated = isGraduated;
    }

    /**
     * @notice Buy tokens using B20 stock tokens.
     */
    function buy(
        uint256 b20AmountIn,
        uint256 minTokensOut,
        address recipient
    ) external override nonReentrant returns (uint256 tokensOut) {
        if (isGraduated) revert CurveAlreadyGraduated();
        if (b20AmountIn == 0) revert ZeroInput();
        if (recipient == address(0)) revert ZeroAddress();

        // 1. Pull B20 tokens from buyer
        bool pullSuccess = IB20Stock(b20Stock).transferFrom(msg.sender, address(this), b20AmountIn);
        if (!pullSuccess) revert TransferFailed();

        // 2. Check remaining target in canonical shares
        uint256 currentShares = totalSharesAccumulated();
        uint256 remainingShares = targetShares > currentShares ? targetShares - currentShares : 0;

        uint256 effectiveB20In = b20AmountIn;
        uint256 refundB20 = 0;

        if (remainingShares > 0) {
            uint256 maxNetB20Allowed = IB20Stock(b20Stock).sharesToTokens(remainingShares);
            uint256 totalFeeBps = creatorFeeBps + protocolFeeBps;
            uint256 maxGrossB20 = totalFeeBps < 10_000
                ? (maxNetB20Allowed * 10_000 + (10_000 - totalFeeBps - 1)) / (10_000 - totalFeeBps)
                : maxNetB20Allowed;

            if (b20AmountIn > maxGrossB20) {
                effectiveB20In = maxGrossB20;
                refundB20 = b20AmountIn - maxGrossB20;

                // Refund excess capital upfront to payer
                bool refundSuccess = IB20Stock(b20Stock).transfer(msg.sender, refundB20);
                if (!refundSuccess) revert TransferFailed();
            }
        }

        // 3. Assess fees ONLY on the effective consumed capital
        uint256 creatorFee = (effectiveB20In * creatorFeeBps) / 10_000;
        uint256 protocolFee = (effectiveB20In * protocolFeeBps) / 10_000;
        uint256 netB20 = effectiveB20In - creatorFee - protocolFee;
        if (netB20 == 0) revert ZeroInput();

        _processCreatorFee(creatorFee);

        if (protocolFee > 0 && protocolFeeRecipient != address(0)) {
            try IB20Stock(b20Stock).transfer(protocolFeeRecipient, protocolFee) {} catch {}
        }

        // 4. Virtual constant product AMM: (vB20 + netB20) * (vTokens - tokensOut) = k
        uint256 k = virtualSharesReserve * virtualTokenReserve;
        uint256 newVirtualB20 = virtualSharesReserve + netB20;
        uint256 newVirtualTokens = k / newVirtualB20;
        tokensOut = virtualTokenReserve - newVirtualTokens;

        if (tokensOut < minTokensOut) revert SlippageExceeded();

        // 5. Enforce anti-dump max wallet cap if enabled
        if (maxWalletTokens > 0) {
            if (BulldotToken(token).balanceOf(recipient) + tokensOut > maxWalletTokens) {
                revert MaxWalletExceeded();
            }
        }

        if (BulldotToken(token).balanceOf(address(this)) < tokensOut + MIGRATION_TOKENS) {
            revert InsufficientReserve();
        }

        virtualSharesReserve = newVirtualB20;
        virtualTokenReserve = newVirtualTokens;
        totalB20Deposited += netB20;

        // 6. Deliver tokens to buyer
        bool tokenSuccess = BulldotToken(token).transfer(recipient, tokensOut);
        if (!tokenSuccess) revert TransferFailed();

        emit TokensPurchased(msg.sender, recipient, effectiveB20In, tokensOut, creatorFee + protocolFee);

        // 7. Auto-migrate if target canonical shares reached
        if (totalSharesAccumulated() >= targetShares) {
            _executeGraduation();
        }
    }

    /**
     * @notice Sell tokens back to the curve for B20 stock tokens.
     */
    function sell(
        uint256 tokenAmountIn,
        uint256 minB20Out,
        address recipient
    ) external override nonReentrant returns (uint256 b20Out) {
        if (isGraduated) revert CurveAlreadyGraduated();
        if (tokenAmountIn == 0) revert ZeroInput();
        if (recipient == address(0)) revert ZeroAddress();

        // 1. Pull tokens from seller
        bool pullSuccess = BulldotToken(token).transferFrom(msg.sender, address(this), tokenAmountIn);
        if (!pullSuccess) revert TransferFailed();

        // 2. Constant product: (vTokens + tokensIn) * (vB20 - b20OutGross) = k
        uint256 k = virtualSharesReserve * virtualTokenReserve;
        uint256 newVirtualTokens = virtualTokenReserve + tokenAmountIn;
        uint256 newVirtualB20 = k / newVirtualTokens;
        uint256 grossB20 = virtualSharesReserve - newVirtualB20;

        if (grossB20 == 0) revert ZeroInput();

        // Mathematical solvency check
        uint256 availableB20 = IB20Stock(b20Stock).balanceOf(address(this));
        if (grossB20 > availableB20) {
            grossB20 = availableB20;
        }

        uint256 creatorFee = (grossB20 * creatorFeeBps) / 10_000;
        uint256 protocolFee = (grossB20 * protocolFeeBps) / 10_000;
        b20Out = grossB20 - creatorFee - protocolFee;

        if (b20Out < minB20Out) revert SlippageExceeded();

        virtualSharesReserve = newVirtualB20;
        virtualTokenReserve = newVirtualTokens;
        if (totalB20Deposited > grossB20) {
            totalB20Deposited -= grossB20;
        } else {
            totalB20Deposited = 0;
        }

        // 3. Distribute fees & payout B20 to seller
        _processCreatorFee(creatorFee);

        if (protocolFee > 0 && protocolFeeRecipient != address(0)) {
            try IB20Stock(b20Stock).transfer(protocolFeeRecipient, protocolFee) {} catch {}
        }

        bool payoutSuccess = IB20Stock(b20Stock).transfer(recipient, b20Out);
        if (!payoutSuccess) revert TransferFailed();

        emit TokensSold(msg.sender, recipient, tokenAmountIn, b20Out, creatorFee + protocolFee);
    }

    /**
     * @dev Routes creator fee through BulldotFeeVault in buffer mode or direct transfer.
     */
    function _processCreatorFee(uint256 creatorFee) internal {
        if (creatorFee == 0) return;

        uint256 shareFee = IB20Stock(b20Stock).tokensToShares(creatorFee);
        totalCreatorFeesCollectedRaw += creatorFee;
        totalCreatorFeesCollectedShares += shareFee;

        // Route through FeeVault: buffer mode ensures unpayable recipient never blocks trading
        if (address(feeVault) != address(0)) {
            IB20Stock(b20Stock).approve(address(feeVault), creatorFee);
            try feeVault.depositFeeFor(token, b20Stock, feeRecipient, creatorFee, false) {
                return;
            } catch {}
        }

        // Safe fallback
        try IB20Stock(b20Stock).transfer(feeRecipient, creatorFee) returns (bool ok) {
            if (ok) {
                emit CreatorFeeCollected(token, feeRecipient, creatorFee);
            }
        } catch {}
    }

    /**
     * @notice Permissionless fallback graduation trigger once target shares reached.
     */
    function graduate() external override nonReentrant {
        if (isGraduated) revert CurveAlreadyGraduated();
        if (totalSharesAccumulated() < targetShares) revert TargetNotReached();
        _executeGraduation();
    }

    /**
     * @dev Executes migration: initializes Uniswap v4 pool and locks 100% of liquidity permanently.
     */
    function _executeGraduation() internal {
        isGraduated = true;

        uint256 b20Balance = IB20Stock(b20Stock).balanceOf(address(this));
        uint256 tokenBalance = BulldotToken(token).balanceOf(address(this));

        // Construct sorted Uniswap v4 PoolKey and amounts
        address currency0;
        address currency1;
        uint256 amount0;
        uint256 amount1;

        if (token < b20Stock) {
            currency0 = token;
            currency1 = b20Stock;
            amount0 = tokenBalance;
            amount1 = b20Balance;
        } else {
            currency0 = b20Stock;
            currency1 = token;
            amount0 = b20Balance;
            amount1 = tokenBalance;
        }

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: DEFAULT_POOL_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: address(0)
        });

        bytes32 poolId = PoolId.unwrap(key.toId());

        uint160 sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);

        // 1. Initialize pool on Uniswap v4 PoolManager
        if (poolManager != address(0)) {
            try IPoolManager(poolManager).initialize(key, sqrtPriceX96) {} catch {}
        }

        // 2. Deploy Liquidity & Permanently Lock to Dead Address
        if (positionManager != address(0)) {
            BulldotToken(token).approve(positionManager, tokenBalance);
            IB20Stock(b20Stock).approve(positionManager, b20Balance);

            IPositionManager.MintParams memory mintParams = IPositionManager.MintParams({
                poolKey: key,
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                liquidity: 0,
                amount0Max: uint128(amount0),
                amount1Max: uint128(amount1),
                recipient: PERMANENT_DEAD, // Permanently minted to 0xDead!
                hookData: ""
            });

            try IPositionManager(positionManager).mint(mintParams) {
                // Successfully locked in Uniswap v4!
            } catch {
                BulldotToken(token).transfer(PERMANENT_DEAD, BulldotToken(token).balanceOf(address(this)));
                IB20Stock(b20Stock).transfer(PERMANENT_DEAD, IB20Stock(b20Stock).balanceOf(address(this)));
            }
        } else {
            BulldotToken(token).transfer(PERMANENT_DEAD, tokenBalance);
            IB20Stock(b20Stock).transfer(PERMANENT_DEAD, b20Balance);
        }

        emit Graduated(token, b20Stock, poolId, b20Balance, tokenBalance, sqrtPriceX96);
    }

    function calculateSqrtPriceX96(uint256 amount0, uint256 amount1) public pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "ZERO_RESERVES");
        uint256 ratio = (amount1 * 1e18) / amount0;
        uint256 sqrtRatio = sqrt(ratio);
        uint256 price = (sqrtRatio * (1 << 96)) / 1e9;
        if (price < MIN_SQRT_RATIO) price = MIN_SQRT_RATIO + 1;
        if (price > MAX_SQRT_RATIO) price = MAX_SQRT_RATIO - 1;
        return uint160(price);
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
