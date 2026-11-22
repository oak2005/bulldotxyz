// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IB20Registry} from "../interfaces/IB20Registry.sol";
import {IB20Stock} from "../interfaces/IB20Stock.sol";

/**
 * @notice SECURITY NOTES:
 * - Mock implementation of official B20 Registry for Base Sepolia testing.
 * - Allows registering mock tokenized stocks and verifying multiplier queries.
 */
contract MockB20Registry is IB20Registry {
    mapping(address => StockMetadata) public stocks;

    function registerStock(
        address token,
        string calldata ticker,
        string calldata cusip,
        address oracleFeed
    ) external {
        stocks[token] = StockMetadata({
            ticker: ticker,
            cusip: cusip,
            tokenAddress: token,
            oracleFeed: oracleFeed,
            isVerified: true
        });

        emit StockRegistered(token, ticker, oracleFeed);
    }

    function setVerificationStatus(address token, bool isVerified) external {
        stocks[token].isVerified = isVerified;
        emit StockVerificationStatusUpdated(token, isVerified);
    }

    function isVerifiedStock(address token) external view override returns (bool) {
        return stocks[token].isVerified;
    }

    function getStockInfo(address token) external view override returns (StockMetadata memory) {
        require(stocks[token].isVerified, "Stock not registered");
        return stocks[token];
    }

    function getMultiplier(address token) external view override returns (uint256) {
        try IB20Stock(token).multiplier() returns (uint256 mult) {
            return mult;
        } catch {
            return 1e18; // Default 1.0x
        }
    }
}

