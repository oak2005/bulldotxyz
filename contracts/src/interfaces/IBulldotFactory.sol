// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey, PoolId} from "./IUniswapV4Minimal.sol";

/**
 * @notice SECURITY NOTES:
 * - Interface for BulldotFactory: the deployment gateway for bulldotxyz on Base.
 * - Supports official Coinbase B20 Registry pattern and autonomous fee vaults.
 * - Enforces pairing restrictions exclusively to verified B20 stock assets.
 * - Includes on-chain token authenticity verification and optional anti-sniper fair-launch controls.
 * - Enforces a maximum protocol/treasury fee hard cap of 0.10% (10 bps).
 */
interface IBulldotFactory {
    error ProtocolFeeExceedsLimit();

    struct InstantPoolParams {
        string name;
        string symbol;
        address b20Stock;
        uint256 b20Amount;
        address feeRecipient;
        uint16 creatorFeeBps; // Max 250 bps (2.5%)
    }

    struct BondingCurveParams {
        string name;
        string symbol;
        address b20Stock;
        address feeRecipient;
        uint16 creatorFeeBps; // Max 250 bps (2.5%)
        uint16 maxWalletBps;  // Anti-dump option (e.g. 200 = 2% max holding, 0 = disabled)
    }

    event InstantPoolLaunched(
        address indexed token,
        address indexed b20Stock,
        PoolId indexed poolId,
        address creator,
        address feeRecipient,
        uint256 initialB20Amount,
        uint256 initialTokenAmount,
        uint16 creatorFeeBps,
        uint160 sqrtPriceX96
    );

    event BondingCurveLaunched(
        address indexed token,
        address indexed curve,
        address indexed b20Stock,
        address creator,
        address feeRecipient,
        uint16 creatorFeeBps,
        uint256 targetShares,
        uint16 maxWalletBps
    );

    event CreatorFeeCollected(
        address indexed token,
        address indexed b20Stock,
        address indexed recipient,
        uint256 feeAmount
    );

    event ProtocolFeeCollected(
        address indexed token,
        address indexed stock,
        address indexed recipient,
        uint256 feeAmount
    );

    event B20RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event B20StockVerificationUpdated(address indexed stock, bool isVerified);
    event ProtocolFeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event ProtocolFeeBpsUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function poolManager() external view returns (address);
    function positionManager() external view returns (address);
    function feeVault() external view returns (address);
    function b20Registry() external view returns (address);
    function protocolFeeRecipient() external view returns (address);
    function protocolFeeBps() external view returns (uint16);
    function isVerifiedB20Stock(address stock) external view returns (bool);
    function isDeployedCurve(address curve) external view returns (bool);
    function isOfficialLaunch(address token) external view returns (bool);
    function tokenToCurve(address token) external view returns (address);
    function tokenToStock(address token) external view returns (address);
    function allTokensCount() external view returns (uint256);
    function owner() external view returns (address);

    function createInstantPool(InstantPoolParams calldata params) external returns (address token, PoolId poolId);
    function createBondingCurve(BondingCurveParams calldata params) external returns (address token, address curve);
    function setB20Registry(address registry) external;
    function setB20StockVerification(address stock, bool isVerified) external;
    function setProtocolFeeRecipient(address newRecipient) external;
    function setProtocolFeeBps(uint16 newFeeBps) external;
    function renounceOwnership() external;
}
