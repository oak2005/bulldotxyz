// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey, PoolId, PoolIdLibrary, IPoolManager, IUnlockCallback} from "../interfaces/IUniswapV4Minimal.sol";

/**
 * @notice SECURITY NOTES:
 * - Standalone mock of Uniswap v4 PoolManager for unit testing on Base Sepolia / local anvil.
 * - Simulates pool initialization and flash accounting unlock mechanics.
 */
contract MockUniswapV4PoolManager is IPoolManager {
    using PoolIdLibrary for PoolKey;

    mapping(bytes32 => bool) public initializedPools;
    mapping(bytes32 => uint160) public poolSqrtPriceX96;

    event PoolInitialized(bytes32 indexed poolId, address currency0, address currency1, uint24 fee, uint160 sqrtPriceX96);
    event LiquidityModified(bytes32 indexed poolId, int24 tickLower, int24 tickUpper, int256 liquidityDelta);

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external override returns (int24 tick) {
        bytes32 id = PoolId.unwrap(key.toId());
        require(!initializedPools[id], "ALREADY_INITIALIZED");
        require(key.currency0 < key.currency1, "CURRENCY_NOT_SORTED");
        require(sqrtPriceX96 > 0, "INVALID_SQRT_PRICE");

        initializedPools[id] = true;
        poolSqrtPriceX96[id] = sqrtPriceX96;

        emit PoolInitialized(id, key.currency0, key.currency1, key.fee, sqrtPriceX96);
        return 0;
    }

    function unlock(bytes calldata data) external override returns (bytes memory) {
        return IUnlockCallback(msg.sender).unlockCallback(data);
    }

    function modifyLiquidity(
        PoolKey memory key,
        ModifyLiquidityParams memory params,
        bytes calldata
    ) external override returns (int256 callerDelta, int256 feesAccrued) {
        bytes32 id = PoolId.unwrap(key.toId());
        require(initializedPools[id], "POOL_NOT_INITIALIZED");
        emit LiquidityModified(id, params.tickLower, params.tickUpper, params.liquidityDelta);
        return (0, 0);
    }

    function sync(address) external override {}
    function take(address, address, uint256) external override {}
    function settle() external payable override returns (uint256) {
        return 0;
    }
}

