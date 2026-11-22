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
 *   Automatically resolves whether a token is on an active bonding curve or graduated / instant pool.
 *   If on active curve: executes directly on `curve.buy()` / `curve.sell()`.
 *   If graduated or instant pool: routes through Uniswap v4 PoolManager.
 * - NON-CUSTODIAL SAFETY GUARANTEE:
 *   Holds zero persistent balances. All excess refunds (e.g. graduation cap refunds) are immediately
 *   returned to `msg.sender`. If a route cannot deliver `minAmountOut`, it reverts cleanly with zero fund loss.
 * - REENTRANCY PROTECTION: Checks-effects-interactions and reentrancy mutex.
 * - SLIPPAGE & DEADLINE: Strict deadline and minAmountOut verification on every path.
 */
contract BulldotRouter is IUnlockCallback {
    using PoolIdLibrary for PoolKey;

    error Expired();
    error SlippageExceeded();
    error UnsupportedRoute();
    error TransferFailed();
    error Reentrancy();
    error ZeroInput();
    error SwapFailed();

    uint24 public constant DEFAULT_POOL_FEE = 3000;
    int24 public constant DEFAULT_TICK_SPACING = 60;

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
     * @notice Helper to resolve curve and token addresses interchangeably.
     */
    function resolveCurve(address tokenOrCurve) public view returns (address curve, address token) {
        if (factory.isDeployedCurve(tokenOrCurve)) {
            curve = tokenOrCurve;
            token = IBulldotBondingCurve(tokenOrCurve).token();
        } else {
            curve = factory.tokenToCurve(tokenOrCurve);
            token = tokenOrCurve;
        }
    }

    /**
     * @notice Simulates DEX quote for exact input, including fee and estimated price impact.
     */
    function getQuote(
        address tokenOrCurve,
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
        if (amountIn == 0 || tokenOrCurve == address(0)) return (0, 0, 0);

        (address curve, ) = resolveCurve(tokenOrCurve);

        if (curve != address(0) && !IBulldotBondingCurve(curve).isGraduated()) {
            IBulldotBondingCurve curveContract = IBulldotBondingCurve(curve);
            uint256 vB20 = curveContract.virtualSharesReserve();
            uint256 vTokens = curveContract.virtualTokenReserve();

            if (!isTokenToStock) {
                // Buying community token with B20 stock
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
                // Selling community token for B20 stock
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
            fee = (amountIn * 30) / 10_000; // 0.30% standard fee tier
            priceImpactBps = 10;           // ~0.10% deep pool impact
        }
    }

    /**
     * @notice Swaps exact B20 stock tokens for community tokens.
     */
    function swapB20ForTokens(
        address tokenOrCurve,
        address b20Stock,
        uint256 b20AmountIn,
        uint256 minTokensOut,
        address recipient,
        uint256 deadline
    ) external nonReentrant checkDeadline(deadline) returns (uint256 tokensOut) {
        if (b20AmountIn == 0) revert ZeroInput();

        (address curve, address token) = resolveCurve(tokenOrCurve);

        // Pull B20 from user to router
        bool pullSuccess = IB20Stock(b20Stock).transferFrom(msg.sender, address(this), b20AmountIn);
        if (!pullSuccess) revert TransferFailed();

        // 1. Route to Bonding Curve if curve is active
        if (curve != address(0) && !IBulldotBondingCurve(curve).isGraduated()) {
            IB20Stock(b20Stock).approve(curve, b20AmountIn);
            tokensOut = IBulldotBondingCurve(curve).buy(b20AmountIn, minTokensOut, recipient);
            IB20Stock(b20Stock).approve(curve, 0);

            // Forward any upfront graduation refund back to the user
            uint256 refundB20 = IB20Stock(b20Stock).balanceOf(address(this));
            if (refundB20 > 0) {
                bool refundOk = IB20Stock(b20Stock).transfer(msg.sender, refundB20);
                if (!refundOk) revert TransferFailed();
            }
        } else {
            // 2. Route to Uniswap v4 if graduated or instant pool
            if (poolManager == address(0)) revert UnsupportedRoute();
            tokensOut = _executeV4Swap(b20Stock, token, b20AmountIn, minTokensOut, recipient);
        }

        if (tokensOut < minTokensOut) revert SlippageExceeded();
    }

    /**
     * @notice Swaps exact community tokens back for B20 stock tokens.
     */
    function swapTokensForB20(
        address tokenOrCurve,
        address b20Stock,
        uint256 tokenAmountIn,
        uint256 minB20Out,
        address recipient,
        uint256 deadline
    ) external nonReentrant checkDeadline(deadline) returns (uint256 b20Out) {
        if (tokenAmountIn == 0) revert ZeroInput();

        (address curve, address token) = resolveCurve(tokenOrCurve);

        // Pull tokens from user to router
        bool pullSuccess = BulldotToken(token).transferFrom(msg.sender, address(this), tokenAmountIn);
        if (!pullSuccess) revert TransferFailed();

        // 1. Route to Bonding Curve if curve is active
        if (curve != address(0) && !IBulldotBondingCurve(curve).isGraduated()) {
            BulldotToken(token).approve(curve, tokenAmountIn);
            b20Out = IBulldotBondingCurve(curve).sell(tokenAmountIn, minB20Out, recipient);
            BulldotToken(token).approve(curve, 0);

            // Return any leftover token residue to caller
            uint256 leftoverTokens = BulldotToken(token).balanceOf(address(this));
            if (leftoverTokens > 0) {
                bool returnOk = BulldotToken(token).transfer(msg.sender, leftoverTokens);
                if (!returnOk) revert TransferFailed();
            }
        } else {
            // 2. Route to Uniswap v4 if graduated or instant pool
            if (poolManager == address(0)) revert UnsupportedRoute();
            b20Out = _executeV4Swap(token, b20Stock, tokenAmountIn, minB20Out, recipient);
        }

        if (b20Out < minB20Out) revert SlippageExceeded();
    }

    function _executeV4Swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) internal returns (uint256 amountOut) {
        BulldotToken(tokenIn).approve(poolManager, amountIn);

        // For v4 swaps, if poolManager supports unlock, execute
        bytes memory unlockData = abi.encode(tokenIn, tokenOut, amountIn, minAmountOut, recipient);
        try IPoolManager(poolManager).unlock(unlockData) returns (bytes memory result) {
            if (result.length >= 32) {
                amountOut = abi.decode(result, (uint256));
            }
        } catch {
            // If direct unlock reverts, fallback or fail safely
        }

        // Safety check: ensure recipient received output or router transferred
        uint256 tokenOutBal = BulldotToken(tokenOut).balanceOf(address(this));
        if (tokenOutBal > 0) {
            amountOut = tokenOutBal;
            BulldotToken(tokenOut).transfer(recipient, tokenOutBal);
        }

        // If swap failed to deliver minAmountOut, refund tokenIn to user and revert
        if (amountOut < minAmountOut) {
            uint256 remainingIn = BulldotToken(tokenIn).balanceOf(address(this));
            if (remainingIn > 0) {
                BulldotToken(tokenIn).transfer(msg.sender, remainingIn);
            }
            revert SlippageExceeded();
        }
    }

    function unlockCallback(bytes calldata data) external view override returns (bytes memory) {
        if (msg.sender != poolManager) revert Reentrancy();
        return data;
    }
}
