// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey, PoolId} from "./IUniswapV4Minimal.sol";

/**
 * @notice SECURITY NOTES:
 * - Interface for BulldotFactory: the deployment gateway for bulldotxyz on Base.
 * - Enforces pairing restrictions exclusively to verified B20 stock assets.
 * - Emits comprehensive indexed events for lightweight off-chain indexers.
 */
interface IBulldotFactory {
    struct InstantPoolParams {
        string name;
        string symbol;
        address b20Stock;
        uint256 b20Amount;
        address feeRecipient;
        uint16 creatorFeeBps; // Max 250 bps (2.5%)
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

    event CreatorFeeCollected(
        address indexed token,
        address indexed b20Stock,
        address indexed recipient,
        uint256 feeAmount
    );

    event B20StockVerificationUpdated(address indexed stock, bool isVerified);
    event ProtocolFeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function poolManager() external view returns (address);
    function positionManager() external view returns (address);
    function protocolFeeRecipient() external view returns (address);
    function isVerifiedB20Stock(address stock) external view returns (bool);
    function owner() external view returns (address);

    function createInstantPool(InstantPoolParams calldata params) external returns (address token, PoolId poolId);
    function setB20StockVerification(address stock, bool isVerified) external;
    function setProtocolFeeRecipient(address newRecipient) external;
    function renounceOwnership() external;
}
