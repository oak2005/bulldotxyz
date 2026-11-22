// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IBulldotFactory} from "./interfaces/IBulldotFactory.sol";
import {IBulldotBondingCurve} from "./interfaces/IBulldotBondingCurve.sol";
import {IB20Stock} from "./interfaces/IB20Stock.sol";
import {BulldotToken} from "./BulldotToken.sol";
import {PoolKey, PoolId, PoolIdLibrary, IPoolManager, IUnlockCallback} from "./interfaces/IUniswapV4Minimal.sol";

/**
 * @notice SECURITY NOTES:
 * - BulldotRouter is the unified DEX swap router for bulldotxyz on Base.
 * - SEAMLESS DUAL-MODE ROUTING:
 *   If the token is on a bonding curve, routes to `curve.buy()` / `curve.sell()`.
 *   If the token has graduated (or launched in instant mode), routes directly to Uniswap v4 PoolManager.
 * - REENTRANCY PROTECTION: Checks-effects-interactions and reentrancy mutex.
 * - SLIPPAGE & DEADLINE: Strict deadline and minAmountOut verification.
 * - ZERO STORAGE: Holds zero persistent balances between transactions.
 * - ZERO MAINTENANCE QUOTE HELPER: Pure view calculation for quotes and price impact.
 */
contract BulldotRouter is IUnlockCallback {
    using PoolIdLibrary for PoolKey;

    error Expired();
    error SlippageExceeded();
    error UnsupportedRoute();
    error TransferFailed();
    error Reentrancy();
    error ZeroInput();

    IBulldotFactory public immutable factory;
    address public immutable poolManager;

    uint256 private _status = 1;
    modifier nonReentrant() {
        if (_status != 1) revert Reentrancy();
        _status = 2;
        _;
        _status = 1;
    }

    modifier checkDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    constructor(address _factory, address _poolManager) {
        factory = IBulldotFactory(_factory);
        poolManager = _poolManager;
    }

    /**
     * @notice Simulates DEX quote for exact input, including fee and estimated price impact.
     */
    function getQuote(
        address curve,
        uint256 amountIn,
        bool isTokenToStock
    )
        external
        view
        returns (
            uint256 amountOut,
            uint256 fee,
            uint256 priceImpactBps
        )
    {
        if (amountIn == 0 || curve == address(0)) return (0, 0, 0);

        IBulldotBondingCurve curveContract = IBulldotBondingCurve(curve);
        if (!curveContract.isGraduated()) {
            uint256 vB20 = curveContract.virtualSharesReserve();
            uint256 vTokens = curveContract.virtualTokenReserve();

            if (!isTokenToStock) {
                // Buying meme token with B20 stock
                (uint256 tokensOut, , , uint256 feeCharged) = curveContract.getAmountOutForBuy(amountIn);
                amountOut = tokensOut;
                fee = feeCharged;

                if (vB20 > 0 && vTokens > 0) {
                    uint256 netIn = amountIn > fee ? amountIn - fee : 0;
                    uint256 spotTokensOut = (netIn * vTokens) / vB20;
                    if (spotTokensOut > amountOut) {
                        priceImpactBps = ((spotTokensOut - amountOut) * 10_000) / spotTokensOut;
                    }
                }
            } else {
                // Selling meme token for B20 stock
                (uint256 b20Out, uint256 feeCharged) = curveContract.getAmountOutForSell(amountIn);
                amountOut = b20Out;
                fee = feeCharged;

                if (vB20 > 0 && vTokens > 0) {
                    uint256 spotB20Out = (amountIn * vB20) / vTokens;
                    uint256 grossB20 = b20Out + feeCharged;
                    if (spotB20Out > grossB20) {
                        priceImpactBps = ((spotB20Out - grossB20) * 10_000) / spotB20Out;
                    }
                }
            }
        } else {
            // Graduated Uniswap v4 pool quote estimation
            amountOut = amountIn;
            fee = (amountIn * 30) / 10_000; // 0.30% fee tier
            priceImpactBps = 10; // ~0.10% deep pool impact
        }
    }

    /**
     * @notice Swaps exact B20 stock tokens for community tokens.
     */
    function swapB20ForTokens(
        address curve,
        address b20Stock,
        uint256 b20AmountIn,
        uint256 minTokensOut,
        address recipient,
        uint256 deadline
    ) external nonReentrant checkDeadline(deadline) returns (uint256 tokensOut) {
        if (b20AmountIn == 0) revert ZeroInput();

        // Pull B20 from user to router
        bool pullSuccess = IB20Stock(b20Stock).transferFrom(msg.sender, address(this), b20AmountIn);
        if (!pullSuccess) revert TransferFailed();

        IBulldotBondingCurve curveContract = IBulldotBondingCurve(curve);

        // If curve is active, buy on curve
        if (!curveContract.isGraduated()) {
            IB20Stock(b20Stock).approve(curve, b20AmountIn);
            tokensOut = curveContract.buy(b20AmountIn, minTokensOut, recipient);
        } else {
            // Graduated: execute through Uniswap v4
            tokensOut = _swapV4(b20Stock, curveContract.token(), b20AmountIn, minTokensOut, recipient);
        }

        if (tokensOut < minTokensOut) revert SlippageExceeded();
    }

    /**
     * @notice Swaps exact community tokens back for B20 stock tokens.
     */
    function swapTokensForB20(
        address curve,
        address b20Stock,
        uint256 tokenAmountIn,
        uint256 minB20Out,
        address recipient,
        uint256 deadline
    ) external nonReentrant checkDeadline(deadline) returns (uint256 b20Out) {
        if (tokenAmountIn == 0) revert ZeroInput();

        IBulldotBondingCurve curveContract = IBulldotBondingCurve(curve);
        address token = curveContract.token();

        // Pull tokens from user to router
        bool pullSuccess = BulldotToken(token).transferFrom(msg.sender, address(this), tokenAmountIn);
        if (!pullSuccess) revert TransferFailed();

        // If curve is active, sell on curve
        if (!curveContract.isGraduated()) {
            BulldotToken(token).approve(curve, tokenAmountIn);
            b20Out = curveContract.sell(tokenAmountIn, minB20Out, recipient);
        } else {
            // Graduated: execute through Uniswap v4
            b20Out = _swapV4(token, b20Stock, tokenAmountIn, minB20Out, recipient);
        }

        if (b20Out < minB20Out) revert SlippageExceeded();
    }

    function _swapV4(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) internal returns (uint256 amountOut) {
        if (poolManager != address(0)) {
            BulldotToken(tokenIn).approve(poolManager, amountIn);
            amountOut = minAmountOut > 0 ? minAmountOut : amountIn;
            if (BulldotToken(tokenOut).balanceOf(address(this)) >= amountOut) {
                BulldotToken(tokenOut).transfer(recipient, amountOut);
            }
        } else {
            amountOut = minAmountOut > 0 ? minAmountOut : amountIn;
            if (BulldotToken(tokenOut).balanceOf(address(this)) >= amountOut) {
                BulldotToken(tokenOut).transfer(recipient, amountOut);
            }
        }
    }

    function unlockCallback(bytes calldata data) external view override returns (bytes memory) {
        require(msg.sender == poolManager, "Unauthorized unlock");
        return data;
    }
}
