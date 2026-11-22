// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @notice SECURITY NOTES:
 * - Official B20 Registry interface for Coinbase Tokenized Stocks on Base.
 * - Tracks verified tokenized equities, on-chain split multipliers, and equity oracle feeds.
 * - Used by BulldotFactory to verify authentic Coinbase B20 assets without hardcoding.
 */
interface IB20Registry {
    struct StockMetadata {
        string ticker;             // Underlying equity symbol (e.g. "COIN", "NVDA", "AAPL")
        string cusip;              // Standard asset identifier
        address tokenAddress;      // The B20 ERC-20 contract on Base
        address oracleFeed;        // Chainlink or Coinbase price/multiplier oracle
        bool isVerified;           // Active status in the official registry
    }

    event StockRegistered(address indexed token, string ticker, address oracleFeed);
    event StockVerificationStatusUpdated(address indexed token, bool isVerified);
    event MultiplierUpdated(address indexed token, uint256 oldMultiplier, uint256 newMultiplier);

    /**
     * @notice Checks if a token is an officially verified B20 stock.
     */
    function isVerifiedStock(address token) external view returns (bool);

    /**
     * @notice Returns complete stock metadata for a verified token.
     */
    function getStockInfo(address token) external view returns (StockMetadata memory);

    /**
     * @notice Returns the live on-chain multiplier for the stock (18 decimals, 1e18 = 1.0x).
     */
    function getMultiplier(address token) external view returns (uint256);
}

