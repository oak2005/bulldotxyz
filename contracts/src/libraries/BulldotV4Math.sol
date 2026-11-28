// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title BulldotV4Math
 * @notice Shared fixed-point math helpers for Uniswap v4 full-range pool initialization,
 *         liquidity computation, and virtual reserve reconstruction across Factory, Curve, and Router.
 */
library BulldotV4Math {
    uint160 internal constant MIN_SQRT_PRICE = 4295128739;
    uint160 internal constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = 887272;

    function alignedTickBounds(int24 tickSpacing) internal pure returns (int24 tickLower, int24 tickUpper) {
        int24 maxAligned = (MAX_TICK / tickSpacing) * tickSpacing;
        tickLower = -maxAligned;
        tickUpper = maxAligned;
    }

    function calculateSqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "ZERO_RESERVES");
        uint256 ratio = mulDiv(amount1, 1e36, amount0);
        uint256 sqrtRatio = sqrt(ratio);
        uint256 price = mulDiv(sqrtRatio, 1 << 96, 1e18);
        if (price <= MIN_SQRT_PRICE) price = MIN_SQRT_PRICE + 1;
        if (price >= MAX_SQRT_PRICE) price = MAX_SQRT_PRICE - 1;
        return uint160(price);
    }

    function computeFullRangeLiquidity(
        uint160 sqrtPriceX96,
        uint256 amount0Max,
        uint256 amount1Max
    ) internal pure returns (uint128) {
        uint256 l0 = mulDiv(amount0Max, uint256(sqrtPriceX96), 1 << 96);
        uint256 l1 = mulDiv(amount1Max, 1 << 96, uint256(sqrtPriceX96));
        uint256 liq = l0 < l1 ? l0 : l1;
        // 0.1% safety margin guarantees settled PoolManager deltas fit strictly inside available reserves
        liq = (liq * 999) / 1000;
        require(liq > 0 && liq <= type(uint128).max, "INVALID_LIQUIDITY");
        return uint128(liq);
    }

    function computeVirtualReserves(
        uint160 sqrtPriceX96,
        uint128 liquidity
    ) internal pure returns (uint256 reserve0, uint256 reserve1) {
        if (sqrtPriceX96 == 0 || liquidity == 0) return (0, 0);
        reserve0 = mulDiv(uint256(liquidity), 1 << 96, uint256(sqrtPriceX96));
        reserve1 = mulDiv(uint256(liquidity), uint256(sqrtPriceX96), 1 << 96);
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

    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256 result) {
        uint256 prod0;
        uint256 prod1;
        assembly {
            let mm := mulmod(a, b, not(0))
            prod0 := mul(a, b)
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }
        if (prod1 == 0) {
            return prod0 / denominator;
        }
        require(denominator > prod1, "MULDIV_OVERFLOW");
        uint256 remainder;
        assembly {
            remainder := mulmod(a, b, denominator)
            prod1 := sub(prod1, gt(remainder, prod0))
            prod0 := sub(prod0, remainder)
        }
        uint256 twos = denominator & (~denominator + 1);
        assembly {
            denominator := div(denominator, twos)
            prod0 := div(prod0, twos)
            twos := add(div(sub(0, twos), twos), 1)
        }
        prod0 |= prod1 * twos;
        uint256 inverse = (3 * denominator) ^ 2;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        result = prod0 * inverse;
    }
}
