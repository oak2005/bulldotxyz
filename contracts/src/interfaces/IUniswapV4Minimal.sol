// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @notice SECURITY NOTES:
 * - Minimal, self-contained Uniswap v4 interfaces for Base Sepolia (84532) and Base Mainnet (8453).
 * - Currencies must strictly satisfy `currency0 < currency1` when constructing PoolKey.
 * - Reentrancy during unlockCallback must be guarded against if custom hooks or callbacks are used.
 */

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

type PoolId is bytes32;

library PoolIdLibrary {
    function toId(PoolKey memory poolKey) internal pure returns (PoolId) {
        return PoolId.wrap(keccak256(abi.encode(poolKey)));
    }
}

interface IPoolManager {
    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
    function unlock(bytes calldata data) external returns (bytes memory);
    function modifyLiquidity(
        PoolKey memory key,
        ModifyLiquidityParams memory params,
        bytes calldata hookData
    ) external returns (int256 callerDelta, int256 feesAccrued);
    function sync(address currency) external;
    function take(address currency, address to, uint256 amount) external;
    function settle() external payable returns (uint256 paid);
}

interface IUnlockCallback {
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}

interface IPositionManager {
    struct MintParams {
        PoolKey poolKey;
        int24 tickLower;
        int24 tickUpper;
        uint256 liquidity;
        uint128 amount0Max;
        uint128 amount1Max;
        address recipient;
        bytes hookData;
    }

    function mint(MintParams calldata params) external payable returns (uint256 tokenId, uint128 amount0, uint128 amount1);
}

