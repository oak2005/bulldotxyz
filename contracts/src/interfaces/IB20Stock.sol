// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IB20Stock
 * @notice Standard interface for Coinbase Tokenized Stocks (B20 standard) on Base.
 * @dev Crucial invariant: 1 Token != 1 Share permanently. Stock splits and corporate
 * actions update the multiplier, altering the redemption ratio between tokens and underlying shares.
 */
interface IB20Stock {
    // ERC-20 standard methods
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    // B20 Specific Methods
    /**
     * @notice Returns the current multiplier (fixed-point with 18 decimals, 1e18 = 1.0x).
     * e.g., after a 2-for-1 forward split, multiplier doubles.
     */
    function multiplier() external view returns (uint256);

    /**
     * @notice Converts an underlying share amount to the corresponding B20 token units.
     */
    function sharesToTokens(uint256 shares) external view returns (uint256 tokens);

    /**
     * @notice Converts a B20 token amount to the corresponding underlying canonical shares.
     */
    function tokensToShares(uint256 tokens) external view returns (uint256 shares);
}
