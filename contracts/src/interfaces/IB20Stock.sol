// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @notice SECURITY NOTES:
 * - Standard interface for Coinbase Tokenized Stocks (B20 standard) on Base.
 * - Key Invariant: 1 Token != 1 Share permanently.
 * - Stock splits and corporate actions update the on-chain multiplier, altering the
 *   conversion ratio between token balances and underlying canonical shares.
 * - Integrations must use `tokensToShares()` and `sharesToTokens()` where share-denominated
 *   economic parity is required.
 */
interface IB20Stock {
    // --- ERC-20 Standard Interface ---
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    // --- B20 Standard Extension ---
    function multiplier() external view returns (uint256);
    function sharesToTokens(uint256 shares) external view returns (uint256 tokens);
    function tokensToShares(uint256 tokens) external view returns (uint256 shares);
}
