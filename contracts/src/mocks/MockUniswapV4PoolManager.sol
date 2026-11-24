// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey, PoolId, PoolIdLibrary, IPoolManager, IUnlockCallback} from "../interfaces/IUniswapV4Minimal.sol";
import {IB20Stock} from "../interfaces/IB20Stock.sol";

/**
 * @notice SECURITY NOTES:
 * - Standalone mock of Uniswap v4 PoolManager for unit testing on local anvil.
 * - Simulates pool initialization, liquidity seeding, constant-product swaps, ETH settle/take, and extsload slots.
 */
contract MockUniswapV4PoolManager is IPoolManager {
    using PoolIdLibrary for PoolKey;

    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));

    mapping(bytes32 => bool) public initializedPools;
    mapping(bytes32 => uint160) public poolSqrtPriceX96;
    mapping(bytes32 => uint128) public poolLiquidity;
    mapping(bytes32 => uint256) public poolReserve0;
    mapping(bytes32 => uint256) public poolReserve1;

    // Reverse lookup from derived storage slot -> value for extsload simulation
    mapping(bytes32 => bytes32) internal _slots;

    event PoolInitialized(bytes32 indexed poolId, address currency0, address currency1, uint24 fee, uint160 sqrtPriceX96);
    event LiquidityModified(bytes32 indexed poolId, int24 tickLower, int24 tickUpper, int256 liquidityDelta);

    receive() external payable {}

    function _updateExtsloadSlots(bytes32 id, uint160 sqrtPriceX96, uint128 liq) internal {
        bytes32 stateSlot = keccak256(abi.encodePacked(id, POOLS_SLOT));
        _slots[stateSlot] = bytes32(uint256(sqrtPriceX96));
        _slots[bytes32(uint256(stateSlot) + 3)] = bytes32(uint256(liq));
    }

    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external override returns (int24 tick) {
        bytes32 id = PoolId.unwrap(key.toId());
        require(!initializedPools[id], "ALREADY_INITIALIZED");
        require(key.currency0 < key.currency1, "CURRENCY_NOT_SORTED");
        require(sqrtPriceX96 > 0, "INVALID_SQRT_PRICE");

        initializedPools[id] = true;
        poolSqrtPriceX96[id] = sqrtPriceX96;
        _updateExtsloadSlots(id, sqrtPriceX96, 0);

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
        require(params.liquidityDelta > 0, "POSITIVE_LIQ_ONLY");

        uint128 added = uint128(uint256(params.liquidityDelta));
        uint160 sqrtP = poolSqrtPriceX96[id];
        uint256 amount0 = (uint256(added) << 96) / uint256(sqrtP);
        uint256 amount1 = (uint256(added) * uint256(sqrtP)) >> 96;

        poolLiquidity[id] += added;
        poolReserve0[id] += amount0;
        poolReserve1[id] += amount1;
        _updateExtsloadSlots(id, sqrtP, poolLiquidity[id]);

        emit LiquidityModified(id, params.tickLower, params.tickUpper, params.liquidityDelta);

        int256 packed = (int256(-int128(uint128(amount0))) << 128) | int256(uint256(uint128(-int128(uint128(amount1)))));
        return (packed, 0);
    }

    function swap(
        PoolKey memory key,
        SwapParams memory params,
        bytes calldata
    ) external override returns (int256 delta) {
        bytes32 id = PoolId.unwrap(key.toId());
        require(initializedPools[id], "POOL_NOT_INITIALIZED");
        require(params.amountSpecified < 0, "EXACT_INPUT_ONLY");

        uint256 amountIn = uint256(-params.amountSpecified);
        uint256 netIn = (amountIn * (1_000_000 - key.fee)) / 1_000_000;

        uint256 r0 = poolReserve0[id];
        uint256 r1 = poolReserve1[id];
        require(r0 > 0 && r1 > 0, "EMPTY_POOL");

        if (params.zeroForOne) {
            uint256 amount1Out = (r1 * netIn) / (r0 + netIn);
            poolReserve0[id] = r0 + netIn;
            poolReserve1[id] = r1 - amount1Out;
            delta = (int256(-int128(uint128(amountIn))) << 128) | int256(uint256(uint128(int128(uint128(amount1Out)))));
        } else {
            uint256 amount0Out = (r0 * netIn) / (r1 + netIn);
            poolReserve1[id] = r1 + netIn;
            poolReserve0[id] = r0 - amount0Out;
            delta = (int256(int128(uint128(amount0Out))) << 128) | int256(uint256(uint128(-int128(uint128(amount1InSafe(amountIn))))));
        }

        // Update sqrtPriceX96 with 18-dec precision to match new reserves
        uint256 newSqrt = _sqrt((poolReserve1[id] * 1e18) / poolReserve0[id]);
        newSqrt = (newSqrt * (1 << 96)) / 1e9;
        if (newSqrt > 0) {
            poolSqrtPriceX96[id] = uint160(newSqrt);
            _updateExtsloadSlots(id, uint160(newSqrt), poolLiquidity[id]);
        }
    }

    function amount1InSafe(uint256 v) internal pure returns (uint256) {
        return v;
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
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

    function sync(address) external override {}

    function take(address currency, address to, uint256 amount) external override {
        if (amount == 0) return;
        if (currency == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            require(ok, "ETH_TAKE_FAILED");
        } else {
            require(IB20Stock(currency).transfer(to, amount), "ERC20_TAKE_FAILED");
        }
    }

    function settle() external payable override returns (uint256) {
        return msg.value;
    }

    function extsload(bytes32 slot) external view override returns (bytes32 value) {
        return _slots[slot];
    }
}
