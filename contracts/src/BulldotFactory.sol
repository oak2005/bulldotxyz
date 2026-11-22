// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IBulldotFactory} from "./interfaces/IBulldotFactory.sol";
import {IB20Stock} from "./interfaces/IB20Stock.sol";
import {IB20Registry} from "./interfaces/IB20Registry.sol";
import {BulldotToken} from "./BulldotToken.sol";
import {BulldotBondingCurve} from "./BulldotBondingCurve.sol";
import {BulldotFeeVault} from "./BulldotFeeVault.sol";
import {PoolKey, PoolId, PoolIdLibrary, IPoolManager, IPositionManager} from "./interfaces/IUniswapV4Minimal.sol";

/**
 * @notice SECURITY NOTES:
 * - BulldotFactory is the core deployment gateway for bulldotxyz on Base.
 * - OFFICIAL B20 REGISTRY PATTERN:
 *   Supports both the official Coinbase B20 Registry contract and local allowlisting.
 *   Verified stock status is checked dynamically via `IB20Registry.isVerifiedStock(stock)`.
 * - FULL FEE SYSTEM & REDIRECTION:
 *   Integrates with BulldotFeeVault to route creator fees on both Instant and Curve launch modes.
 *   Enables transparent tracking of raw B20 token fees alongside normalized share values.
 * - PERMANENT LIQUIDITY LOCK: All liquidity created by instant mode or bonding curve graduation is irreversibly
 *   minted/locked to `address(0x000000000000000000000000000000000000dEaD)`. No withdrawal hooks exist anywhere.
 * - MINIMAL LOCKED-DOWN ADMIN: Owner powers are strictly limited to updating the B20 registry/allowlist
 *   and protocol fee recipient. Owner CANNOT touch user funds, pause trading, or alter token supply.
 *   Ownership can be renounced via `renounceOwnership()`.
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

    // --- Uniswap v4 Constants ---
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;
    int24 internal constant TICK_LOWER = -887220;
    int24 internal constant TICK_UPPER = 887220;
    uint16 public constant MAX_CREATOR_FEE_BPS = 250; // Max 2.5%
    uint24 public constant DEFAULT_POOL_FEE = 3000;    // 0.30% Uniswap v4 standard tier
    int24 public constant DEFAULT_TICK_SPACING = 60;
    address public constant PERMANENT_DEAD = address(0x000000000000000000000000000000000000dEaD);

    // --- Protocol Configuration ---
    address public override owner;
    address public immutable override poolManager;
    address public immutable override positionManager;
    address public override protocolFeeRecipient;
    address public override feeVault;
    address public override b20Registry;

    // --- B20 Stock Allowlist ---
    mapping(address => bool) public isVerifiedB20StockMapping;

    // --- Deployed Registries ---
    mapping(address => bool) public override isDeployedCurve;
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
        address _feeVault,
        address _b20Registry,
        address[] memory _initialVerifiedStocks
    ) {
        if (_poolManager == address(0)) revert ZeroAddress();

        owner = msg.sender;
        poolManager = _poolManager;
        positionManager = _positionManager;
        protocolFeeRecipient = _protocolFeeRecipient == address(0) ? msg.sender : _protocolFeeRecipient;

        // Deploy default fee vault if none provided
        feeVault = _feeVault == address(0) ? address(new BulldotFeeVault()) : _feeVault;
        b20Registry = _b20Registry;

        for (uint256 i = 0; i < _initialVerifiedStocks.length; i++) {
            address stock = _initialVerifiedStocks[i];
            if (stock != address(0)) {
                isVerifiedB20StockMapping[stock] = true;
                emit B20StockVerificationUpdated(stock, true);
            }
        }
    }

    /**
     * @notice Checks whether a token is verified B20 stock via local allowlist or official B20 registry.
     */
    function isVerifiedB20Stock(address stock) public view override returns (bool) {
        if (isVerifiedB20StockMapping[stock]) return true;
        if (b20Registry != address(0)) {
            try IB20Registry(b20Registry).isVerifiedStock(stock) returns (bool verified) {
                return verified;
            } catch {}
        }
        return false;
    }

    /**
     * @notice Launch Mode 1: Instant Uniswap v4 pool with permanent liquidity lock to 0xDead.
     */
    function createInstantPool(InstantPoolParams calldata params)
        external
        override
        nonReentrant
        returns (address tokenAddr, PoolId poolId)
    {
        // 1. Validation
        if (!isVerifiedB20Stock(params.b20Stock)) revert StockNotVerified();
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

        // 3. Deploy fixed-supply BulldotToken (1 Billion supply minted 100% to this factory)
        BulldotToken token = new BulldotToken(params.name, params.symbol, address(this));
        tokenAddr = address(token);
        allLaunchedTokens.push(tokenAddr);

        // 4. Handle Creator Fee & FeeVault registration
        uint256 creatorFee = (params.b20Amount * params.creatorFeeBps) / 10_000;
        uint256 netB20ForPool = params.b20Amount - creatorFee;

        if (feeVault != address(0)) {
            BulldotFeeVault(feeVault).registerToken(tokenAddr, params.feeRecipient, msg.sender);
        }

        if (creatorFee > 0) {
            if (feeVault != address(0)) {
                IB20Stock(params.b20Stock).approve(feeVault, creatorFee);
                try BulldotFeeVault(feeVault).depositFee(tokenAddr, params.b20Stock, creatorFee, true) {} catch {
                    bool feeSuccess = IB20Stock(params.b20Stock).transfer(params.feeRecipient, creatorFee);
                    if (!feeSuccess) revert TransferFailed();
                }
            } else {
                bool feeSuccess = IB20Stock(params.b20Stock).transfer(params.feeRecipient, creatorFee);
                if (!feeSuccess) revert TransferFailed();
            }
            emit CreatorFeeCollected(tokenAddr, params.b20Stock, params.feeRecipient, creatorFee);
        }

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

        // 8. Permanently Lock Liquidity in Uniswap v4 or fallback to Dead address
        if (positionManager != address(0)) {
            token.approve(positionManager, tokenAmountForPool);
            IB20Stock(params.b20Stock).approve(positionManager, netB20ForPool);

            IPositionManager.MintParams memory mintParams = IPositionManager.MintParams({
                poolKey: key,
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                liquidity: 0,
                amount0Max: uint128(amount0),
                amount1Max: uint128(amount1),
                recipient: PERMANENT_DEAD,
                hookData: ""
            });

            try IPositionManager(positionManager).mint(mintParams) {
                // Successfully locked!
            } catch {
                bool deadTransferToken = token.transfer(PERMANENT_DEAD, token.balanceOf(address(this)));
                bool deadTransferB20 = IB20Stock(params.b20Stock).transfer(PERMANENT_DEAD, IB20Stock(params.b20Stock).balanceOf(address(this)));
                if (!deadTransferToken || !deadTransferB20) revert TransferFailed();
            }
        } else {
            bool deadTransferToken = token.transfer(PERMANENT_DEAD, tokenAmountForPool);
            bool deadTransferB20 = IB20Stock(params.b20Stock).transfer(PERMANENT_DEAD, netB20ForPool);
            if (!deadTransferToken || !deadTransferB20) revert TransferFailed();
        }

        // 9. Emit indexing event
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
     * @notice Launch Mode 2: Launch a new token with an autonomous bonding curve paired with a verified B20 stock.
     */
    function createBondingCurve(BondingCurveParams calldata params)
        external
        override
        nonReentrant
        returns (address tokenAddr, address curveAddr)
    {
        // 1. Validation
        if (!isVerifiedB20Stock(params.b20Stock)) revert StockNotVerified();
        if (params.creatorFeeBps > MAX_CREATOR_FEE_BPS) revert CreatorFeeExceedsLimit();
        if (params.feeRecipient == address(0)) revert ZeroAddress();

        // 2. Deploy BulldotToken with supply minted to factory for immediate handoff
        BulldotToken token = new BulldotToken(params.name, params.symbol, address(this));
        tokenAddr = address(token);
        allLaunchedTokens.push(tokenAddr);

        // 3. Register token with FeeVault
        if (feeVault != address(0)) {
            BulldotFeeVault(feeVault).registerToken(tokenAddr, params.feeRecipient, msg.sender);
        }

        // 4. Canonical target: 50 canonical shares
        uint256 targetShares = 50 * 1e18;

        // 5. Deploy BulldotBondingCurve with FeeVault integration
        BulldotBondingCurve curve = new BulldotBondingCurve(
            tokenAddr,
            params.b20Stock,
            msg.sender,
            params.feeRecipient,
            protocolFeeRecipient,
            feeVault,
            params.creatorFeeBps,
            0, // Default protocol fee
            targetShares,
            poolManager,
            positionManager
        );
        curveAddr = address(curve);
        isDeployedCurve[curveAddr] = true;

        // 6. Transfer 100% of token supply to the curve
        bool transferSuccess = token.transfer(curveAddr, token.totalSupply());
        if (!transferSuccess) revert TransferFailed();

        // 7. Emit clean event for indexing
        emit BondingCurveLaunched(
            tokenAddr,
            curveAddr,
            params.b20Stock,
            msg.sender,
            params.feeRecipient,
            params.creatorFeeBps,
            targetShares
        );
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

    // --- Minimal Admin Functions ---

    function setB20Registry(address newRegistry) external override onlyOwner {
        emit B20RegistryUpdated(b20Registry, newRegistry);
        b20Registry = newRegistry;
    }

    function setB20StockVerification(address stock, bool isVerified) external override onlyOwner {
        if (stock == address(0)) revert ZeroAddress();
        isVerifiedB20StockMapping[stock] = isVerified;
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
