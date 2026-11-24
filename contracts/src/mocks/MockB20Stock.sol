// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IB20Stock} from "../interfaces/IB20Stock.sol";

/**
 * @notice SECURITY NOTES:
 * - Mock implementation of Coinbase Tokenized Stock (B20 standard) for Base Sepolia testing.
 * - Real Coinbase tokenized stocks exist on Base mainnet. This mock replicates the multiplier
 *   and share conversion mechanics to test stock splits and corporate actions.
 * - Includes `simulateStockSplit()` to alter the multiplier and verify accounting safety.
 */
contract MockB20Stock is IB20Stock {
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroMultiplier();

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    // Multiplier scaled to 18 decimals (1e18 = 1.0x).
    uint256 public multiplier = 1e18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event MultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    /**
     * @notice Permissionless testnet faucet delivering +100 stock tokens to caller.
     */
    function faucet() external {
        uint256 amount = 100 * 1e18;
        totalSupply += amount;
        balanceOf[msg.sender] += amount;
        emit Transfer(address(0), msg.sender, amount);
    }

    function setMultiplier(uint256 newMultiplier) external {
        if (newMultiplier == 0) revert ZeroMultiplier();
        emit MultiplierUpdated(multiplier, newMultiplier);
        multiplier = newMultiplier;
    }

    /**
     * @notice Simulates a stock split or reverse split.
     * @param newMultiplier New multiplier value in 18-decimal fixed point (e.g. 2e18 for a 2-for-1 forward split).
     */
    function simulateStockSplit(uint256 newMultiplier) external {
        if (newMultiplier == 0) revert ZeroMultiplier();
        emit MultiplierUpdated(multiplier, newMultiplier);
        multiplier = newMultiplier;
    }

    function sharesToTokens(uint256 shares) public view override returns (uint256) {
        return (shares * multiplier) / 1e18;
    }

    function tokensToShares(uint256 tokens) public view override returns (uint256) {
        return (tokens * 1e18) / multiplier;
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        uint256 curAllowance = allowance[sender][msg.sender];
        if (curAllowance != type(uint256).max) {
            if (curAllowance < amount) revert InsufficientAllowance();
            unchecked {
                allowance[sender][msg.sender] = curAllowance - amount;
            }
        }
        _transfer(sender, recipient, amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        if (balanceOf[sender] < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[sender] -= amount;
            balanceOf[recipient] += amount;
        }
        emit Transfer(sender, recipient, amount);
    }
}
