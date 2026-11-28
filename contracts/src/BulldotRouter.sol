// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IBulldotFactory} from "./interfaces/IBulldotFactory.sol";
import {IBulldotBondingCurve} from "./interfaces/IBulldotBondingCurve.sol";
import {IB20Stock} from "./interfaces/IB20Stock.sol";
import {BulldotToken} from "./BulldotToken.sol";
import {BulldotV4Math} from "./libraries/BulldotV4Math.sol";
import {PoolKey, PoolId, PoolIdLibrary, IPoolManager, IUnlockCallback} from "./interfaces/IUniswapV4Minimal.sol";

/**
 * @notice SECURITY NOTES:
 * - BulldotRouter is the unified DEX swap router for bulldotxyz on Base.
 * - ATOMIC 2-HOP ETH <-> B20 STOCK <-> MEME ROUTING:
 *   Supports single-transaction swaps from native ETH -> B20 stock (via Uniswap v4) -> community token
 *   (via Bonding Curve or Uniswap v4), and in reverse from community token -> B20 stock -> native ETH.
 * - SEAMLESS DUAL-MODE ROUTING:
 *   Automatically resolves whether a token is on an active bonding curve or graduated / instant v4 pool.
 * - NON-CUSTODIAL SAFETY GUARANTEE:
 *   Holds zero persistent ETH or token balances. All excess graduation refunds and unused ETH settle amounts
 *   are immediately returned to `msg.sender`.
 * - HOOKLESS V4 CONFIGURABILITY:
 *   ETH/Stock v4 pool parameters (`fee`, `tickSpacing`) are configurable by `owner` (renounceable) for
 *   mainnet migration with `hooks` strictly locked to `address(0)`.
 */
contract BulldotRouter is IUnlockCallback {
    using PoolIdLibrary for PoolKey;

    error Expired();
    error SlippageExceeded();
    error UnsupportedRoute();
    error TransferFailed();
    error Reentrancy();
    error ZeroInput();
    error ZeroAddress();
    error Unauthorized();
    error InvalidPair();
    error PoolNotInitialized();

    uint160 internal constant MIN_SQRT_PRICE = 4295128739;
    uint160 internal constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;
    int24 internal constant TICK_LOWER = -887220;
    int24 internal constant TICK_UPPER = 887220;
    uint24 public constant DEFAULT_POOL_FEE = 3000;
    int24 public constant DEFAULT_TICK_SPACING = 60;
    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));

    enum CallbackAction {
        SWAP,
        ADD_LIQUIDITY
    }

    struct SwapCallbackData {
        PoolKey key;
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
        address recipient;
        uint256 msgValue;
    }

    struct AddLiquidityCallbackData {
        PoolKey key;
        uint128 liquidityDelta;
        uint256 maxEth;
        uint256 maxStock;
    }

    struct EthPoolConfig {
        uint24 fee;
        int24 tickSpacing;
        bool configured;
    }

    event EthToTokenSwapped(
        address indexed sender,
        address indexed recipient,
        address indexed token,
        address b20Stock,
        uint256 ethIn,
        uint256 b20Intermediate,
        uint256 tokensOut
    );

    event TokenToEthSwapped(
        address indexed sender,
        address indexed recipient,
        address indexed token,
        address b20Stock,
        uint256 tokensIn,
        uint256 b20Intermediate,
        uint256 ethOut
    );

    event EthStockPoolSeeded(
        address indexed provider,
        address indexed b20Stock,
        PoolId indexed poolId,
        uint256 ethAdded,
        uint256 stockAdded,
        uint128 liquidityAdded
    );

    event EthPoolConfigUpdated(address indexed b20Stock, uint24 fee, int24 tickSpacing);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    IBulldotFactory public immutable factory;
    address public immutable poolManager;
    address public owner;

    mapping(address => EthPoolConfig) public ethPoolConfigs;

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

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address _factory, address _poolManager) {
        if (_factory == address(0) || _poolManager == address(0)) revert ZeroAddress();
        factory = IBulldotFactory(_factory);
        poolManager = _poolManager;
        owner = msg.sender;
    }

    receive() external payable {}

    function setEthPoolConfig(address b20Stock, uint24 fee, int24 tickSpacing) external onlyOwner {
        if (b20Stock == address(0)) revert ZeroAddress();
        ethPoolConfigs[b20Stock] = EthPoolConfig({fee: fee, tickSpacing: tickSpacing, configured: true});
        emit EthPoolConfigUpdated(b20Stock, fee, tickSpacing);
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    function getEthStockPoolKey(address b20Stock) public view returns (PoolKey memory) {
        EthPoolConfig memory cfg = ethPoolConfigs[b20Stock];
        uint24 fee = cfg.configured ? cfg.fee : DEFAULT_POOL_FEE;
        int24 tickSpacing = cfg.configured ? cfg.tickSpacing : DEFAULT_TICK_SPACING;
        return PoolKey({
            currency0: address(0),
            currency1: b20Stock,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: address(0)
        });
    }

    /**
     * @notice Reads live sqrtPriceX96, active liquidity, and derived virtual reserves for an ETH/B20 pool.
     */
    function getEthStockReserves(address b20Stock)
        public
        view
        returns (
            uint160 sqrtPriceX96,
            uint128 liquidity,
            uint256 virtualEth,
            uint256 virtualStock
        )
    {
        PoolKey memory key = getEthStockPoolKey(b20Stock);
        PoolId id = key.toId();
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(id), POOLS_SLOT));

        bytes32 slot0 = IPoolManager(poolManager).extsload(stateSlot);
        sqrtPriceX96 = uint160(uint256(slot0));
        if (sqrtPriceX96 == 0) return (0, 0, 0, 0);

        bytes32 liqRaw = IPoolManager(poolManager).extsload(bytes32(uint256(stateSlot) + 3));
        liquidity = uint128(uint256(liqRaw));
        if (liquidity == 0) return (sqrtPriceX96, 0, 0, 0);

        virtualEth = BulldotV4Math.mulDiv(uint256(liquidity), 1 << 96, uint256(sqrtPriceX96));
        virtualStock = BulldotV4Math.mulDiv(uint256(liquidity), uint256(sqrtPriceX96), 1 << 96);
    }

    /**
     * @notice Reads live sqrtPriceX96, active liquidity, and derived virtual reserves for a Token/B20 v4 pool.
     */
    function getTokenStockReserves(address token, address b20Stock)
        public
        view
        returns (
            uint160 sqrtPriceX96,
            uint128 liquidity,
            uint256 virtualToken,
            uint256 virtualStock
        )
    {
        if (token == address(0) || b20Stock == address(0) || poolManager == address(0)) {
            return (0, 0, 0, 0);
        }
        bool tokenIs0 = token < b20Stock;
        PoolKey memory key = PoolKey({
            currency0: tokenIs0 ? token : b20Stock,
            currency1: tokenIs0 ? b20Stock : token,
            fee: DEFAULT_POOL_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: address(0)
        });
        PoolId id = key.toId();
        bytes32 stateSlot = keccak256(abi.encodePacked(PoolId.unwrap(id), POOLS_SLOT));

        bytes32 slot0 = IPoolManager(poolManager).extsload(stateSlot);
        sqrtPriceX96 = uint160(uint256(slot0));
        if (sqrtPriceX96 == 0) return (0, 0, 0, 0);

        bytes32 liqRaw = IPoolManager(poolManager).extsload(bytes32(uint256(stateSlot) + 3));
        liquidity = uint128(uint256(liqRaw));
        if (liquidity == 0) return (sqrtPriceX96, 0, 0, 0);

        (uint256 r0, uint256 r1) = BulldotV4Math.computeVirtualReserves(sqrtPriceX96, liquidity);
        virtualToken = tokenIs0 ? r0 : r1;
        virtualStock = tokenIs0 ? r1 : r0;
    }

    /**
     * @notice Resolves curve and token addresses interchangeably.
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
     * @notice Simulates DEX quote for B20 <-> community token.
     */
    function getQuote(
        address tokenOrCurve,
        uint256 amountIn,
        bool isTokenToStock
    )
        public
        view
        returns (
            uint256 amountOut,
            uint256 fee,
            uint256 priceImpactBps
        )
    {
        if (amountIn == 0 || tokenOrCurve == address(0)) return (0, 0, 0);

        (address curve, address token) = resolveCurve(tokenOrCurve);

        if (curve != address(0) && !IBulldotBondingCurve(curve).isGraduated()) {
            IBulldotBondingCurve curveContract = IBulldotBondingCurve(curve);
            uint256 vB20 = curveContract.virtualSharesReserve();
            uint256 vTokens = curveContract.virtualTokenReserve();

            if (!isTokenToStock) {
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
            address b20Stock = curve != address(0)
                ? IBulldotBondingCurve(curve).b20Stock()
                : factory.tokenToStock(token);
            if (b20Stock == address(0)) return (0, 0, 0);

            (uint160 sqrtP, uint128 liq, uint256 vToken, uint256 vStock) = getTokenStockReserves(token, b20Stock);
            if (sqrtP == 0 || liq == 0 || vToken == 0 || vStock == 0) return (0, 0, 0);

            if (!isTokenToStock) {
                fee = (amountIn * DEFAULT_POOL_FEE) / 1_000_000;
                uint256 netIn = amountIn - fee;
                amountOut = (vToken * netIn) / (vStock + netIn);
                priceImpactBps = (netIn * 10_000) / (vStock + netIn);
            } else {
                uint256 v4TokenFee = (amountIn * DEFAULT_POOL_FEE) / 1_000_000;
                uint256 netTokenIn = amountIn - v4TokenFee;
                amountOut = (vStock * netTokenIn) / (vToken + netTokenIn);
                fee = (vStock * v4TokenFee) / (vToken + netTokenIn);
                priceImpactBps = (netTokenIn * 10_000) / (vToken + netTokenIn);
            }
        }
    }

    /**
     * @notice Simulates full 2-hop quote: Native ETH -> B20 Stock (Uniswap v4) -> Community Token.
     */
    function getQuoteEthToTokens(
        address tokenOrCurve,
        address b20Stock,
        uint256 ethAmountIn
    )
        external
        view
        returns (
            uint256 tokensOut,
            uint256 estimatedStockOut,
            uint256 totalFeeStock,
            uint256 priceImpactBps
        )
    {
        if (ethAmountIn == 0 || b20Stock == address(0)) return (0, 0, 0, 0);

        (uint160 sqrtP, uint128 liq, uint256 vEth, uint256 vStock) = getEthStockReserves(b20Stock);
        if (sqrtP == 0 || liq == 0 || vEth == 0 || vStock == 0) return (0, 0, 0, 0);

        PoolKey memory ethKey = getEthStockPoolKey(b20Stock);
        uint256 ethNet = (ethAmountIn * (1_000_000 - ethKey.fee)) / 1_000_000;
        estimatedStockOut = (vStock * ethNet) / (vEth + ethNet);

        uint256 hop1ImpactBps = ((ethNet * 10_000) / (vEth + ethNet));
        (uint256 outTokens, uint256 feeStock, uint256 hop2ImpactBps) = getQuote(
            tokenOrCurve,
            estimatedStockOut,
            false
        );

        tokensOut = outTokens;
        totalFeeStock = feeStock + ((vStock * (ethAmountIn - ethNet)) / (vEth + ethNet));
        priceImpactBps = hop1ImpactBps + hop2ImpactBps;
        if (priceImpactBps > 10_000) priceImpactBps = 10_000;
    }

    /**
     * @notice Simulates full 2-hop quote: Community Token -> B20 Stock -> Native ETH (Uniswap v4).
     */
    function getQuoteTokensToEth(
        address tokenOrCurve,
        address b20Stock,
        uint256 tokenAmountIn
    )
        external
        view
        returns (
            uint256 ethOut,
            uint256 estimatedStockOut,
            uint256 totalFeeStock,
            uint256 priceImpactBps
        )
    {
        if (tokenAmountIn == 0 || b20Stock == address(0)) return (0, 0, 0, 0);

        (uint160 sqrtP, uint128 liq, uint256 vEth, uint256 vStock) = getEthStockReserves(b20Stock);
        if (sqrtP == 0 || liq == 0 || vEth == 0 || vStock == 0) return (0, 0, 0, 0);

        (uint256 stockOut, uint256 feeStock, uint256 hop1ImpactBps) = getQuote(
            tokenOrCurve,
            tokenAmountIn,
            true
        );
        if (stockOut == 0) return (0, 0, feeStock, hop1ImpactBps);

        PoolKey memory ethKey = getEthStockPoolKey(b20Stock);
        uint256 stockNet = (stockOut * (1_000_000 - ethKey.fee)) / 1_000_000;
        ethOut = (vEth * stockNet) / (vStock + stockNet);

        uint256 hop2ImpactBps = ((stockNet * 10_000) / (vStock + stockNet));
        estimatedStockOut = stockOut;
        totalFeeStock = feeStock + (stockOut - stockNet);
        priceImpactBps = hop1ImpactBps + hop2ImpactBps;
        if (priceImpactBps > 10_000) priceImpactBps = 10_000;
    }

    /**
     * @notice Initializes (if needed) and seeds full-range ETH/B20 liquidity inside Uniswap v4 PoolManager.
     *         Refunds any unused ETH and stock tokens back to the caller.
     */
    function seedEthStockPool(address b20Stock, uint256 stockAmount)
        external
        payable
        nonReentrant
        returns (uint128 liquidityAdded)
    {
        if (b20Stock == address(0)) revert ZeroAddress();
        if (msg.value == 0 || stockAmount == 0) revert ZeroInput();

        PoolKey memory key = getEthStockPoolKey(b20Stock);
        (uint160 sqrtPriceX96, , , ) = getEthStockReserves(b20Stock);

        if (sqrtPriceX96 == 0) {
            sqrtPriceX96 = calculateSqrtPriceX96(msg.value, stockAmount);
            IPoolManager(poolManager).initialize(key, sqrtPriceX96);
        }

        if (!IB20Stock(b20Stock).transferFrom(msg.sender, address(this), stockAmount)) {
            revert TransferFailed();
        }

        liquidityAdded = BulldotV4Math.computeFullRangeLiquidity(sqrtPriceX96, msg.value, stockAmount);

        bytes memory result = IPoolManager(poolManager).unlock(
            abi.encode(
                CallbackAction.ADD_LIQUIDITY,
                abi.encode(
                    AddLiquidityCallbackData({
                        key: key,
                        liquidityDelta: liquidityAdded,
                        maxEth: msg.value,
                        maxStock: stockAmount
                    })
                )
            )
        );

        (uint256 ethUsed, uint256 stockUsed) = abi.decode(result, (uint256, uint256));

        uint256 ethLeftover = address(this).balance;
        if (ethLeftover > 0) {
            (bool okEth, ) = payable(msg.sender).call{value: ethLeftover}("");
            if (!okEth) revert TransferFailed();
        }

        uint256 stockLeftover = IB20Stock(b20Stock).balanceOf(address(this));
        if (stockLeftover > 0) {
            if (!IB20Stock(b20Stock).transfer(msg.sender, stockLeftover)) revert TransferFailed();
        }

        emit EthStockPoolSeeded(msg.sender, b20Stock, key.toId(), ethUsed, stockUsed, liquidityAdded);
    }

    /**
     * @notice Atomic 2-hop buy: Native ETH -> B20 Stock (Uniswap v4) -> Community Token.
     */
    function swapEthForTokens(
        address tokenOrCurve,
        address b20Stock,
        uint256 minTokensOut,
        address recipient,
        uint256 deadline
    ) external payable nonReentrant checkDeadline(deadline) returns (uint256 tokensOut) {
        if (msg.value == 0) revert ZeroInput();
        if (recipient == address(0) || b20Stock == address(0)) revert ZeroAddress();

        (address curve, address token) = resolveCurve(tokenOrCurve);
        if (token == address(0)) revert InvalidPair();
        if (curve != address(0) && IBulldotBondingCurve(curve).b20Stock() != b20Stock) revert InvalidPair();

        // Hop 1: ETH -> B20 Stock via Uniswap v4 PoolManager
        PoolKey memory ethKey = getEthStockPoolKey(b20Stock);
        (uint160 sqrtPriceX96, , , ) = getEthStockReserves(b20Stock);
        if (sqrtPriceX96 == 0) revert PoolNotInitialized();

        bytes memory hop1Res = IPoolManager(poolManager).unlock(
            abi.encode(
                CallbackAction.SWAP,
                abi.encode(
                    SwapCallbackData({
                        key: ethKey,
                        zeroForOne: true,
                        amountSpecified: -int256(msg.value),
                        sqrtPriceLimitX96: MIN_SQRT_PRICE + 1,
                        recipient: address(this),
                        msgValue: msg.value
                    })
                )
            )
        );
        (, uint256 b20Received) = abi.decode(hop1Res, (uint256, uint256));
        if (b20Received == 0) revert SlippageExceeded();

        // Refund any unused ETH back to caller
        uint256 leftoverEth = address(this).balance;
        if (leftoverEth > 0) {
            (bool okEth, ) = payable(msg.sender).call{value: leftoverEth}("");
            if (!okEth) revert TransferFailed();
        }

        // Hop 2: B20 Stock -> Community Token (Curve or Graduated v4)
        tokensOut = _swapB20ToMemeInternal(curve, token, b20Stock, b20Received, minTokensOut, recipient);
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        // Forward any unconsumed graduation B20 refund back to caller
        uint256 refundB20 = IB20Stock(b20Stock).balanceOf(address(this));
        if (refundB20 > 0) {
            if (!IB20Stock(b20Stock).transfer(msg.sender, refundB20)) revert TransferFailed();
        }

        emit EthToTokenSwapped(msg.sender, recipient, token, b20Stock, msg.value - leftoverEth, b20Received, tokensOut);
    }

    /**
     * @notice Atomic 2-hop sell: Community Token -> B20 Stock -> Native ETH (Uniswap v4).
     */
    function swapTokensForEth(
        address tokenOrCurve,
        address b20Stock,
        uint256 tokenAmountIn,
        uint256 minEthOut,
        address recipient,
        uint256 deadline
    ) external nonReentrant checkDeadline(deadline) returns (uint256 ethOut) {
        if (tokenAmountIn == 0) revert ZeroInput();
        if (recipient == address(0) || b20Stock == address(0)) revert ZeroAddress();

        (address curve, address token) = resolveCurve(tokenOrCurve);
        if (token == address(0)) revert InvalidPair();
        if (curve != address(0) && IBulldotBondingCurve(curve).b20Stock() != b20Stock) revert InvalidPair();

        PoolKey memory ethKey = getEthStockPoolKey(b20Stock);
        (uint160 sqrtPriceX96, , , ) = getEthStockReserves(b20Stock);
        if (sqrtPriceX96 == 0) revert PoolNotInitialized();

        if (!BulldotToken(token).transferFrom(msg.sender, address(this), tokenAmountIn)) {
            revert TransferFailed();
        }

        // Hop 1: Community Token -> B20 Stock (delivered to Router for Hop 2)
        uint256 b20Intermediate = _swapMemeToB20Internal(curve, token, b20Stock, tokenAmountIn, 0, address(this));
        if (b20Intermediate == 0) revert SlippageExceeded();

        // Hop 2: B20 Stock -> Native ETH sent directly to recipient
        bytes memory hop2Res = IPoolManager(poolManager).unlock(
            abi.encode(
                CallbackAction.SWAP,
                abi.encode(
                    SwapCallbackData({
                        key: ethKey,
                        zeroForOne: false,
                        amountSpecified: -int256(b20Intermediate),
                        sqrtPriceLimitX96: MAX_SQRT_PRICE - 1,
                        recipient: recipient,
                        msgValue: 0
                    })
                )
            )
        );
        (, ethOut) = abi.decode(hop2Res, (uint256, uint256));
        if (ethOut < minEthOut) revert SlippageExceeded();

        // Forward any residual tokens cleanly to caller
        uint256 leftoverB20 = IB20Stock(b20Stock).balanceOf(address(this));
        if (leftoverB20 > 0) {
            if (!IB20Stock(b20Stock).transfer(msg.sender, leftoverB20)) revert TransferFailed();
        }

        emit TokenToEthSwapped(msg.sender, recipient, token, b20Stock, tokenAmountIn, b20Intermediate, ethOut);
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
        if (recipient == address(0)) revert ZeroAddress();

        (address curve, address token) = resolveCurve(tokenOrCurve);

        if (!IB20Stock(b20Stock).transferFrom(msg.sender, address(this), b20AmountIn)) {
            revert TransferFailed();
        }

        tokensOut = _swapB20ToMemeInternal(curve, token, b20Stock, b20AmountIn, minTokensOut, recipient);
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        uint256 refundB20 = IB20Stock(b20Stock).balanceOf(address(this));
        if (refundB20 > 0) {
            if (!IB20Stock(b20Stock).transfer(msg.sender, refundB20)) revert TransferFailed();
        }
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
        if (recipient == address(0)) revert ZeroAddress();

        (address curve, address token) = resolveCurve(tokenOrCurve);

        if (!BulldotToken(token).transferFrom(msg.sender, address(this), tokenAmountIn)) {
            revert TransferFailed();
        }

        b20Out = _swapMemeToB20Internal(curve, token, b20Stock, tokenAmountIn, minB20Out, recipient);
        if (b20Out < minB20Out) revert SlippageExceeded();

        uint256 leftoverTokens = BulldotToken(token).balanceOf(address(this));
        if (leftoverTokens > 0) {
            if (!BulldotToken(token).transfer(msg.sender, leftoverTokens)) revert TransferFailed();
        }
    }

    function _swapB20ToMemeInternal(
        address curve,
        address token,
        address b20Stock,
        uint256 b20AmountIn,
        uint256 minTokensOut,
        address recipient
    ) internal returns (uint256 tokensOut) {
        if (curve != address(0) && !IBulldotBondingCurve(curve).isGraduated()) {
            IB20Stock(b20Stock).approve(curve, b20AmountIn);
            tokensOut = IBulldotBondingCurve(curve).buy(b20AmountIn, minTokensOut, recipient);
            IB20Stock(b20Stock).approve(curve, 0);
        } else {
            tokensOut = _executeV4Swap(b20Stock, token, b20AmountIn, minTokensOut, recipient);
        }
    }

    function _swapMemeToB20Internal(
        address curve,
        address token,
        address b20Stock,
        uint256 tokenAmountIn,
        uint256 minB20Out,
        address recipient
    ) internal returns (uint256 b20Out) {
        if (curve != address(0) && !IBulldotBondingCurve(curve).isGraduated()) {
            BulldotToken(token).approve(curve, tokenAmountIn);
            b20Out = IBulldotBondingCurve(curve).sell(tokenAmountIn, minB20Out, recipient);
            BulldotToken(token).approve(curve, 0);
        } else {
            b20Out = _executeV4Swap(token, b20Stock, tokenAmountIn, minB20Out, recipient);
        }
    }

    function _executeV4Swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) internal returns (uint256 amountOut) {
        if (poolManager == address(0)) revert UnsupportedRoute();

        bool zeroForOne = tokenIn < tokenOut;
        PoolKey memory key = PoolKey({
            currency0: zeroForOne ? tokenIn : tokenOut,
            currency1: zeroForOne ? tokenOut : tokenIn,
            fee: DEFAULT_POOL_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: address(0)
        });

        bytes memory res = IPoolManager(poolManager).unlock(
            abi.encode(
                CallbackAction.SWAP,
                abi.encode(
                    SwapCallbackData({
                        key: key,
                        zeroForOne: zeroForOne,
                        amountSpecified: -int256(amountIn),
                        sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE + 1 : MAX_SQRT_PRICE - 1,
                        recipient: recipient,
                        msgValue: 0
                    })
                )
            )
        );

        (, amountOut) = abi.decode(res, (uint256, uint256));
        if (amountOut < minAmountOut) revert SlippageExceeded();
    }

    function unlockCallback(bytes calldata rawData) external override returns (bytes memory) {
        if (msg.sender != poolManager) revert Reentrancy();

        (CallbackAction action, bytes memory payload) = abi.decode(rawData, (CallbackAction, bytes));

        if (action == CallbackAction.SWAP) {
            SwapCallbackData memory data = abi.decode(payload, (SwapCallbackData));
            int256 delta = IPoolManager(poolManager).swap(
                data.key,
                IPoolManager.SwapParams({
                    zeroForOne: data.zeroForOne,
                    amountSpecified: data.amountSpecified,
                    sqrtPriceLimitX96: data.sqrtPriceLimitX96
                }),
                ""
            );

            int128 d0 = int128(delta >> 128);
            int128 d1 = int128(delta);

            address cIn = data.zeroForOne ? data.key.currency0 : data.key.currency1;
            address cOut = data.zeroForOne ? data.key.currency1 : data.key.currency0;
            int128 dIn = data.zeroForOne ? d0 : d1;
            int128 dOut = data.zeroForOne ? d1 : d0;

            uint256 amountInUsed = dIn < 0 ? uint256(uint128(-dIn)) : 0;
            uint256 amountOut = dOut > 0 ? uint256(uint128(dOut)) : 0;

            if (amountInUsed > 0) {
                if (cIn == address(0)) {
                    IPoolManager(poolManager).settle{value: amountInUsed}();
                } else {
                    IPoolManager(poolManager).sync(cIn);
                    if (!IB20Stock(cIn).transfer(poolManager, amountInUsed)) revert TransferFailed();
                    IPoolManager(poolManager).settle();
                }
            }

            if (amountOut > 0) {
                IPoolManager(poolManager).take(cOut, data.recipient, amountOut);
            }

            return abi.encode(amountInUsed, amountOut);
        } else {
            AddLiquidityCallbackData memory data = abi.decode(payload, (AddLiquidityCallbackData));
            (int24 tickLower, int24 tickUpper) = BulldotV4Math.alignedTickBounds(data.key.tickSpacing);
            (int256 callerDelta, ) = IPoolManager(poolManager).modifyLiquidity(
                data.key,
                IPoolManager.ModifyLiquidityParams({
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    liquidityDelta: int256(uint256(data.liquidityDelta)),
                    salt: bytes32(0)
                }),
                ""
            );

            int128 d0 = int128(callerDelta >> 128);
            int128 d1 = int128(callerDelta);

            uint256 ethUsed = d0 < 0 ? uint256(uint128(-d0)) : 0;
            uint256 stockUsed = d1 < 0 ? uint256(uint128(-d1)) : 0;
            if (ethUsed > data.maxEth || stockUsed > data.maxStock) revert TransferFailed();

            if (ethUsed > 0) {
                IPoolManager(poolManager).settle{value: ethUsed}();
            }
            if (stockUsed > 0) {
                IPoolManager(poolManager).sync(data.key.currency1);
                if (!IB20Stock(data.key.currency1).transfer(poolManager, stockUsed)) revert TransferFailed();
                IPoolManager(poolManager).settle();
            }

            if (d0 > 0) {
                IPoolManager(poolManager).take(data.key.currency0, address(this), uint256(uint128(d0)));
            }
            if (d1 > 0) {
                IPoolManager(poolManager).take(data.key.currency1, address(this), uint256(uint128(d1)));
            }

            return abi.encode(ethUsed, stockUsed);
        }
    }

    function calculateSqrtPriceX96(uint256 amount0, uint256 amount1) public pure returns (uint160) {
        if (amount0 == 0 || amount1 == 0) revert ZeroInput();
        return BulldotV4Math.calculateSqrtPriceX96(amount0, amount1);
    }
}
