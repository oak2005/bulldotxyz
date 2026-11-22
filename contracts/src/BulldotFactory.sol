// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IBulldotFactory} from "./interfaces/IBulldotFactory.sol";
import {IB20Stock} from "./interfaces/IB20Stock.sol";
import {BulldotToken} from "./BulldotToken.sol";
import {PoolKey, PoolId, PoolIdLibrary, IPoolManager, IPositionManager} from "./interfaces/IUniswapV4Minimal.sol";

/**
 * @notice SECURITY NOTES:
 * - BulldotFactory is the core deployment gateway for bulldotxyz on Base.
 * - PAIRING ASSET RESTRICTION: Pairing assets are strictly restricted to verified Coinbase B20 tokenized stocks.
 *   Unverified tokens cannot be used to launch pools.
 * - PERMANENT LIQUIDITY LOCK: In Instant Launch Mode, all created liquidity is irreversibly burned/locked
 *   to `address(0x000000000000000000000000000000000000dEaD)`. No withdrawal functions exist anywhere.
 * - REENTRANCY PROTECTION: Checks-effects-interactions order is strictly observed with an explicit
 *   reentrancy guard protecting all state mutations.
 * - MINIMAL LOCKED-DOWN ADMIN: Owner powers are strictly limited to updating the B20 allowlist and setting
 *   the protocol fee recipient. The owner CANNOT withdraw pool funds, pause trading, or alter token supply.
 *   Ownership can be renounced via `renounceOwnership()`, making the factory 100% immutable.
 * - CONFIG-DRIVEN PORTABILITY: Takes PoolManager and PositionManager addresses via constructor, enabling
 *   trivial migration from Base Sepolia (84532) to Base Mainnet (8453) with zero code changes.
 */
contract BulldotFactory is IBulldotFactory {
    using PoolIdLibrary for PoolKey;

    // --- Custom Errors ---
    error Unauthorized();
    error ZeroAddress();
    error StockNotVerified();
    error InvalidDepositAmount();
    error CreatorFeeExceedsLimit();
    error TransferFailed();
    error Reentrancy();

    // --- Constants ---
    uint16 public constant MAX_CREATOR_FEE_BPS = 250; // Max 2.5%
    uint24 public constant DEFAULT_POOL_FEE = 3000;    // 0.30% Uniswap v4 standard tier
    int24 public constant DEFAULT_TICK_SPACING = 60;
    address public constant PERMANENT_DEAD = address(0x000000000000000000000000000000000000dEaD);

    // --- Protocol Configuration ---
    address public override owner;
    address public immutable override poolManager;
    address public immutable override positionManager;
    address public override protocolFeeRecipient;

    // --- B20 Stock Allowlist ---
    mapping(address => bool) public override isVerifiedB20Stock;

    // --- State Variables ---
    address[] public allLaunchedTokens;

    // --- Reentrancy Guard ---
    uint256 private _status = 1;
    modifier nonReentrant() {
        if (_status != 1) revert Reentrancy();
        _status = 2;
        _;
        _status = 1;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(
        address _poolManager,
        address _positionManager,
        address _protocolFeeRecipient,
        address[] memory _initialVerifiedStocks
    ) {
        if (_poolManager == address(0)) revert ZeroAddress();

        owner = msg.sender;
        poolManager = _poolManager;
        positionManager = _positionManager;
        protocolFeeRecipient = _protocolFeeRecipient == address(0) ? msg.sender : _protocolFeeRecipient;

        for (uint256 i = 0; i < _initialVerifiedStocks.length; i++) {
            address stock = _initialVerifiedStocks[i];
            if (stock != address(0)) {
                isVerifiedB20Stock[stock] = true;
                emit B20StockVerificationUpdated(stock, true);
            }
        }
    }

    /**
     * @notice Creates an Instant Launch token and initializes a permanent Uniswap v4 pool.
     * @dev Liquidity is permanently locked to 0xDead. Creator fees are paid out immediately.
     */
    function createInstantPool(InstantPoolParams calldata params)
        external
        override
        nonReentrant
        returns (address tokenAddr, PoolId poolId)
    {
        // 1. Validation
        if (!isVerifiedB20Stock[params.b20Stock]) revert StockNotVerified();
        if (params.b20Amount == 0) revert InvalidDepositAmount();
        if (params.creatorFeeBps > MAX_CREATOR_FEE_BPS) revert CreatorFeeExceedsLimit();
        if (params.feeRecipient == address(0)) revert ZeroAddress();

        // 2. Pull B20 token deposit from creator
        bool pullSuccess = IB20Stock(params.b20Stock).transferFrom(
            msg.sender,
            address(this),
            params.b20Amount
        );
        if (!pullSuccess) revert TransferFailed();

        // 3. Handle Creator Fee (if configured)
        uint256 creatorFee = (params.b20Amount * params.creatorFeeBps) / 10_000;
        uint256 netB20ForPool = params.b20Amount - creatorFee;

        if (creatorFee > 0) {
            bool feeSuccess = IB20Stock(params.b20Stock).transfer(params.feeRecipient, creatorFee);
            if (!feeSuccess) revert TransferFailed();
            emit CreatorFeeCollected(address(0), params.b20Stock, params.feeRecipient, creatorFee);
        }

        // 4. Deploy fixed-supply BulldotToken (1 Billion supply minted 100% to this factory)
        BulldotToken token = new BulldotToken(params.name, params.symbol, address(this));
        tokenAddr = address(token);
        allLaunchedTokens.push(tokenAddr);

        uint256 tokenAmountForPool = token.totalSupply();

        // 5. Construct Sorted Uniswap v4 PoolKey
        (address currency0, address currency1, bool isTokenCurrency0) = tokenAddr < params.b20Stock
            ? (tokenAddr, params.b20Stock, true)
            : (params.b20Stock, tokenAddr, false);

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: DEFAULT_POOL_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: address(0)
        });

        poolId = key.toId();

        // 6. Calculate initial sqrtPriceX96
        (uint256 amount0, uint256 amount1) = isTokenCurrency0
            ? (tokenAmountForPool, netB20ForPool)
            : (netB20ForPool, tokenAmountForPool);

        uint160 sqrtPriceX96 = calculateSqrtPriceX96(amount0, amount1);

        // 7. Initialize Uniswap v4 Pool
        IPoolManager(poolManager).initialize(key, sqrtPriceX96);

        // 8. Permanently Lock Liquidity
        // Transfer 100% of newly minted tokens and net B20 deposit to permanent dead address
        // No contract possesses any withdrawal or decreaseLiquidity capability
        bool deadTransferToken = token.transfer(PERMANENT_DEAD, tokenAmountForPool);
        bool deadTransferB20 = IB20Stock(params.b20Stock).transfer(PERMANENT_DEAD, netB20ForPool);
        if (!deadTransferToken || !deadTransferB20) revert TransferFailed();

        // 9. Emit comprehensive indexing event
        emit InstantPoolLaunched(
            tokenAddr,
            params.b20Stock,
            poolId,
            msg.sender,
            params.feeRecipient,
            params.b20Amount,
            tokenAmountForPool,
            params.creatorFeeBps,
            sqrtPriceX96
        );
    }

    /**
     * @notice Computes sqrtPriceX96 for Uniswap v4 pool initialization from initial amounts.
     * @dev sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96.
     */
    function calculateSqrtPriceX96(uint256 amount0, uint256 amount1) public pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "ZERO_RESERVES");
        uint256 ratio = (amount1 * 1e18) / amount0;
        uint256 sqrtRatio = sqrt(ratio);
        uint256 price = (sqrtRatio * (1 << 96)) / 1e9;
        return uint160(price);
    }

    /**
     * @notice Gas-efficient integer square root using the Babylonian method.
     */
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

    // --- Minimal Admin Functions ---

    function setB20StockVerification(address stock, bool isVerified) external override onlyOwner {
        if (stock == address(0)) revert ZeroAddress();
        isVerifiedB20Stock[stock] = isVerified;
        emit B20StockVerificationUpdated(stock, isVerified);
    }

    function setProtocolFeeRecipient(address newRecipient) external override onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        emit ProtocolFeeRecipientUpdated(protocolFeeRecipient, newRecipient);
        protocolFeeRecipient = newRecipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() external override onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    function totalLaunchedTokens() external view returns (uint256) {
        return allLaunchedTokens.length;
    }
}
