// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IB20Stock} from "./interfaces/IB20Stock.sol";

/**
 * @title MockB20Stock
 * @notice Realistic test mock of Coinbase Tokenized Stock (B20 standard) with configurable multiplier.
 * Used for testing stock splits and verifying invariant safety on Base Sepolia and local tests.
 */
contract MockB20Stock is IB20Stock {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    // Multiplier fixed-point 18 decimals (1e18 = 1.0x).
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

    function setMultiplier(uint256 _newMultiplier) external {
        require(_newMultiplier > 0, "Invalid multiplier");
        emit MultiplierUpdated(multiplier, _newMultiplier);
        multiplier = _newMultiplier;
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
            require(curAllowance >= amount, "Insufficient allowance");
            allowance[sender][msg.sender] = curAllowance - amount;
        }
        _transfer(sender, recipient, amount);
        return true;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal {
        require(balanceOf[sender] >= amount, "Balance too low");
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
    }
}
