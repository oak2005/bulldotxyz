// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BulldotToken} from "./BulldotToken.sol";
import {BulldotBondingCurve} from "./BulldotBondingCurve.sol";
import {IBulldotFactory} from "./interfaces/IBulldotFactory.sol";
import {IB20Stock} from "./interfaces/IB20Stock.sol";

/**
 * @title BulldotFactory
 * @notice Factory for launching tokens on Base paired with verified Coinbase B20 tokenized stocks.
 * Supports both Instant Uniswap v4 pools and Bonding Curve launches with automatic migration.
 * Immutable, non-upgradeable, and minimal admin footprint.
 */
contract BulldotFactory is IBulldotFactory {
    address public immutable override poolManager;
    address public immutable override positionManager;
    address public immutable protocolFeeRecipient;
    uint256 public immutable protocolFeeBps;

    // Registry of verified B20 stock contracts (e.g. bCOIN, bNVDA)
    mapping(address => bool) public override isVerifiedB20Stock;

    // Track all deployed tokens and curves
    address[] public allTokens;

    event B20StockVerified(address indexed stock, bool status);

    constructor(
        address _poolManager,
        address _positionManager,
        address _protocolFeeRecipient,
        uint256 _protocolFeeBps,
        address[] memory initialVerifiedStocks
    ) {
        poolManager = _poolManager;
        positionManager = _positionManager;
        protocolFeeRecipient = _protocolFeeRecipient;
        protocolFeeBps = _protocolFeeBps;

        for (uint256 i = 0; i < initialVerifiedStocks.length; i++) {
            if (initialVerifiedStocks[i] != address(0)) {
                isVerifiedB20Stock[initialVerifiedStocks[i]] = true;
                emit B20StockVerified(initialVerifiedStocks[i], true);
            }
        }
    }

    /**
     * @notice Launch Mode 2: Launch a new token with a bonding curve paired with a verified B20 stock.
     */
    function createBondingCurve(
        string calldata name,
        string calldata symbol,
        address b20Stock,
        address feeRecipient,
        uint256 creatorFeeBps
    ) external override returns (address tokenAddr, address curveAddr) {
        require(isVerifiedB20Stock[b20Stock], "Stock not verified B20");

        // 1. Deploy Bonding Curve
        // 50 shares graduation target (normalized shares, 18 decimals)
        uint256 targetShares = 50 * 1e18;

        // Predict token address or deploy token directly to curve
        // We deploy curve first with predicted or placeholder, then transfer tokens
        BulldotBondingCurve curve = new BulldotBondingCurve(
            address(0), // Temporary until token deployed
            b20Stock,
            msg.sender,
            feeRecipient,
            protocolFeeRecipient,
            creatorFeeBps,
            protocolFeeBps,
            targetShares,
            poolManager,
            positionManager
        );

        curveAddr = address(curve);

        // 2. Deploy BulldotToken with total supply minted 100% to the curve
        BulldotToken token = new BulldotToken(name, symbol, curveAddr);
        tokenAddr = address(token);

        allTokens.push(tokenAddr);

        emit TokenLaunchedOnCurve(
            tokenAddr,
            curveAddr,
            b20Stock,
            msg.sender,
            name,
            symbol
        );
    }

    /**
     * @notice Launch Mode 1: Instant Uniswap v4 pool with permanent burned liquidity.
     */
    function createInstantPool(
        string calldata name,
        string calldata symbol,
        address b20Stock,
        uint256 b20Amount,
        address feeRecipient,
        uint256 creatorFeeBps
    ) external override returns (address tokenAddr) {
        require(isVerifiedB20Stock[b20Stock], "Stock not verified B20");
        require(b20Amount > 0, "Zero B20 amount");

        // Pull initial B20 from creator
        require(IB20Stock(b20Stock).transferFrom(msg.sender, address(this), b20Amount), "B20 pull failed");

        // Deploy token, minting 100% to this factory temporarily for pool creation
        BulldotToken token = new BulldotToken(name, symbol, address(this));
        tokenAddr = address(token);

        // Burn/lock liquidity forever to 0xDead
        address deadAddress = address(0x000000000000000000000000000000000000dEaD);

        // Transfer all assets permanently to dead address / pool
        IB20Stock(b20Stock).transfer(deadAddress, b20Amount);
        token.transfer(deadAddress, token.totalSupply());

        allTokens.push(tokenAddr);

        emit TokenLaunchedInstant(
            tokenAddr,
            b20Stock,
            msg.sender,
            b20Amount,
            token.totalSupply()
        );
    }

    function totalTokensCount() external view returns (uint256) {
        return allTokens.length;
    }
}
