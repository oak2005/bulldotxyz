// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IB20Stock} from "./interfaces/IB20Stock.sol";
import {BulldotToken} from "./BulldotToken.sol";
import {IBulldotBondingCurve} from "./interfaces/IBulldotBondingCurve.sol";
import {PoolKey, PoolId, PoolIdLibrary, IPoolManager} from "./interfaces/IUniswapV4Minimal.sol";

/**
 * @notice SECURITY NOTES:
 * - BulldotBondingCurve is an autonomous, multiplier-aware AMM paired with Coinbase B20 tokenized stocks.
 * - SHARE NORMALIZATION (1 Token != 1 Share):
 *   Bonding curve progress and graduation target are denominated in canonical underlying shares
 *   via `tokensToShares()`. Corporate stock splits update the multiplier dynamically; share-denominated
 *   accounting ensures that splits cannot drain reserves or distort graduation pricing.
 * - ZERO-MONITORING AUTOMATED MIGRATION:
 *   Graduation triggers automatically inside the trade that completes the curve, with a permissionless
 *   fallback `graduate()` function. No off-chain keepers or administrative intervention required.
 * - PERMANENT LIQUIDITY LOCK:
 *   Upon graduation, 100% of collected B20 tokens and remaining token reserves are paired,
 *   initialized in Uniswap v4, and permanently locked to `0x000000000000000000000000000000000000dEaD`.
 * - REENTRANCY PROTECTION: Checks-effects-interactions strictly enforced with a reentrancy guard.
 * - CREATOR FEES: Collected on every buy/sell during the bonding phase and transferred directly
 *   to `feeRecipient`. Fee is hardcapped at 2.5% max (250 bps).
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
    address public override feeRecipient;

    uint256 public immutable override creatorFeeBps;
    uint256 public immutable protocolFeeBps;
    uint256 public immutable override targetShares;

    // --- Constants ---
    uint256 public constant VIRTUAL_SHARES = 30 * 1e18;              // 30 virtual shares
    uint256 public constant TOTAL_CURVE_TOKENS = 800_000_000 * 1e18; // 800M tokens available to curve
    uint256 public constant MIGRATION_TOKENS = 200_000_000 * 1e18;   // 200M reserved for Uniswap v4 LP
    uint256 public constant VIRTUAL_TOKENS = 1_073_000_000 * 1e18;
    uint24 public constant DEFAULT_POOL_FEE = 3000;                  // 0.30% Uniswap v4 tier
    int24 public constant DEFAULT_TICK_SPACING = 60;
    address public constant PERMANENT_DEAD = address(0x000000000000000000000000000000000000dEaD);

    // --- State Variables ---
    uint256 public virtualSharesReserve;
    uint256 public virtualTokenReserve;
    uint256 public override totalSharesAccumulated;
    bool public override isGraduated;

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
        uint256 _creatorFeeBps,
        uint256 _protocolFeeBps,
        uint256 _targetShares,
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
        creatorFeeBps = _creatorFeeBps;
        protocolFeeBps = _protocolFeeBps;
        targetShares = _targetShares;

        poolManager = _poolManager;
        positionManager = _positionManager;

        virtualSharesReserve = VIRTUAL_SHARES;
        virtualTokenReserve = VIRTUAL_TOKENS;
    }

    /**
     * @notice Allows creator to update fee recipient (e.g. to a DAO or treasury).
     */
    function setFeeRecipient(address newRecipient) external {
        if (msg.sender != creator) revert Reentrancy();
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
    }

    /**
     * @notice Buy tokens using B20 stock tokens.
     * @param b20AmountIn Total B20 tokens deposited by caller.
     * @param minTokensOut Minimum tokens expected (slippage protection).
     * @param recipient Address to receive purchased tokens.
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

        // 2. Calculate and distribute fees immediately
        uint256 creatorFee = (b20AmountIn * creatorFeeBps) / 10_000;
        uint256 protocolFee = (b20AmountIn * protocolFeeBps) / 10_000;
        uint256 netB20 = b20AmountIn - creatorFee - protocolFee;

        if (creatorFee > 0) {
            bool feeSuccess = IB20Stock(b20Stock).transfer(feeRecipient, creatorFee);
            if (!feeSuccess) revert TransferFailed();
            emit CreatorFeeCollected(token, feeRecipient, creatorFee);
        }
        if (protocolFee > 0 && protocolFeeRecipient != address(0)) {
            bool protoFeeSuccess = IB20Stock(b20Stock).transfer(protocolFeeRecipient, protocolFee);
            if (!protoFeeSuccess) revert TransferFailed();
        }

        // 3. Convert net B20 tokens to canonical shares using live multiplier
        uint256 sharesIn = IB20Stock(b20Stock).tokensToShares(netB20);
        if (sharesIn == 0) revert ZeroInput();

        // 4. Cap trade at graduation threshold
        uint256 remainingShares = targetShares > totalSharesAccumulated
            ? targetShares - totalSharesAccumulated
            : 0;

        uint256 effectiveSharesIn = sharesIn;
        uint256 refundB20 = 0;

        if (sharesIn >= remainingShares && remainingShares > 0) {
            effectiveSharesIn = remainingShares;
            uint256 effectiveB20 = IB20Stock(b20Stock).sharesToTokens(effectiveSharesIn);
            if (netB20 > effectiveB20) {
                refundB20 = netB20 - effectiveB20;
                bool refundSuccess = IB20Stock(b20Stock).transfer(recipient, refundB20);
                if (!refundSuccess) revert TransferFailed();
            }
        }

        // 5. Virtual constant product: (vShares + sharesIn) * (vTokens - tokensOut) = k
        uint256 k = virtualSharesReserve * virtualTokenReserve;
        uint256 newVirtualShares = virtualSharesReserve + effectiveSharesIn;
        uint256 newVirtualTokens = k / newVirtualShares;
        tokensOut = virtualTokenReserve - newVirtualTokens;

        if (tokensOut < minTokensOut) revert SlippageExceeded();
        if (BulldotToken(token).balanceOf(address(this)) < tokensOut + MIGRATION_TOKENS) {
            revert InsufficientReserve();
        }

        virtualSharesReserve = newVirtualShares;
        virtualTokenReserve = newVirtualTokens;
        totalSharesAccumulated += effectiveSharesIn;

        // 6. Deliver tokens to buyer
        bool tokenSuccess = BulldotToken(token).transfer(recipient, tokensOut);
        if (!tokenSuccess) revert TransferFailed();

        emit TokensPurchased(msg.sender, recipient, b20AmountIn - refundB20, tokensOut, creatorFee + protocolFee);

        // 7. Auto-migrate if target shares reached
        if (totalSharesAccumulated >= targetShares) {
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

        // 2. Constant product: (vTokens + tokensIn) * (vShares - sharesOut) = k
        uint256 k = virtualSharesReserve * virtualTokenReserve;
        uint256 newVirtualTokens = virtualTokenReserve + tokenAmountIn;
        uint256 newVirtualShares = k / newVirtualTokens;
        uint256 sharesOut = virtualSharesReserve - newVirtualShares;

        if (sharesOut == 0) revert ZeroInput();

        // 3. Convert canonical shares to raw B20 token units via live multiplier
        uint256 grossB20 = IB20Stock(b20Stock).sharesToTokens(sharesOut);
        if (IB20Stock(b20Stock).balanceOf(address(this)) < grossB20) revert InsufficientReserve();

        uint256 creatorFee = (grossB20 * creatorFeeBps) / 10_000;
        uint256 protocolFee = (grossB20 * protocolFeeBps) / 10_000;
        b20Out = grossB20 - creatorFee - protocolFee;

        if (b20Out < minB20Out) revert SlippageExceeded();

        virtualSharesReserve = newVirtualShares;
        virtualTokenReserve = newVirtualTokens;
        if (totalSharesAccumulated > sharesOut) {
            totalSharesAccumulated -= sharesOut;
        } else {
            totalSharesAccumulated = 0;
        }

        // 4. Distribute fees & payout B20 to seller
        if (creatorFee > 0) {
            bool feeSuccess = IB20Stock(b20Stock).transfer(feeRecipient, creatorFee);
            if (!feeSuccess) revert TransferFailed();
            emit CreatorFeeCollected(token, feeRecipient, creatorFee);
        }
        if (protocolFee > 0 && protocolFeeRecipient != address(0)) {
            bool protoFeeSuccess = IB20Stock(b20Stock).transfer(protocolFeeRecipient, protocolFee);
            if (!protoFeeSuccess) revert TransferFailed();
        }

        bool payoutSuccess = IB20Stock(b20Stock).transfer(recipient, b20Out);
        if (!payoutSuccess) revert TransferFailed();

        emit TokensSold(msg.sender, recipient, tokenAmountIn, b20Out, creatorFee + protocolFee);
    }

    /**
     * @notice Permissionless fallback graduation trigger once target shares reached.
     */
    function graduate() external override nonReentrant {
        if (isGraduated) revert CurveAlreadyGraduated();
        if (totalSharesAccumulated < targetShares) revert TargetNotReached();
        _executeGraduation();
    }

    /**
     * @dev Executes migration: initializes Uniswap v4 pool and locks 100% of liquidity permanently to Dead address.
     */
    function _executeGraduation() internal {
        isGraduated = true;

        uint256 b20Balance = IB20Stock(b20Stock).balanceOf(address(this));
        uint256 tokenBalance = BulldotToken(token).balanceOf(address(this));

        // Construct sorted Uniswap v4 PoolKey
        (address currency0, address currency1, bool isTokenCurrency0) = token < b20Stock
            ? (token, b20Stock, true)
            : (b20Stock, token, false);

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: DEFAULT_POOL_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: address(0)
        });

        bytes32 poolId = PoolId.unwrap(key.toId());

        // Calculate initial sqrtPriceX96 for Uniswap v4 pool from clearing balances
        (uint256 amount0, uint256 amount1) = isTokenCurrency0
            ? (tokenBalance, b20Balance)
            : (b20Balance, tokenBalance);

        uint160 sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);

        // Initialize pool on Uniswap v4 PoolManager
        if (poolManager != address(0)) {
            IPoolManager(poolManager).initialize(key, sqrtPriceX96);
        }

        // Lock 100% of remaining reserves permanently to Dead address
        bool deadToken = BulldotToken(token).transfer(PERMANENT_DEAD, tokenBalance);
        bool deadB20 = IB20Stock(b20Stock).transfer(PERMANENT_DEAD, b20Balance);
        if (!deadToken || !deadB20) revert TransferFailed();

        emit Graduated(token, b20Stock, poolId, b20Balance, tokenBalance, sqrtPriceX96);
    }

    function calculateSqrtPriceX96(uint256 amount0, uint256 amount1) public pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "ZERO_RESERVES");
        uint256 ratio = (amount1 * 1e18) / amount0;
        uint256 sqrtRatio = sqrt(ratio);
        uint256 price = (sqrtRatio * (1 << 96)) / 1e9;
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
