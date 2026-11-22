// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBulldotFactory {
    event TokenLaunchedOnCurve(
        address indexed token,
        address indexed bondingCurve,
        address indexed b20Stock,
        address creator,
        string name,
        string symbol
    );

    event TokenLaunchedInstant(
        address indexed token,
        address indexed b20Stock,
        address creator,
        uint256 initialB20Amount,
        uint256 initialTokenAmount
    );

    function poolManager() external view returns (address);
    function positionManager() external view returns (address);
    function isVerifiedB20Stock(address stock) external view returns (bool);

    function createBondingCurve(
        string calldata name,
        string calldata symbol,
        address b20Stock,
        address feeRecipient,
        uint256 creatorFeeBps
    ) external returns (address token, address curve);

    function createInstantPool(
        string calldata name,
        string calldata symbol,
        address b20Stock,
        uint256 b20Amount,
        address feeRecipient,
        uint256 creatorFeeBps
    ) external returns (address token);
}
