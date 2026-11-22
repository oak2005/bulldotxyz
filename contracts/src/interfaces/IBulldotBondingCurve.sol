// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBulldotBondingCurve {
    event TokensPurchased(
        address indexed buyer,
        address indexed recipient,
        uint256 b20In,
        uint256 tokensOut,
        uint256 feeB20
    );

    event TokensSold(
        address indexed seller,
        address indexed recipient,
        uint256 tokensIn,
        uint256 b20Out,
        uint256 feeB20
    );

    event Graduated(
        address indexed token,
        address indexed b20Stock,
        uint256 b20Reserve,
        uint256 tokenReserve
    );

    function token() external view returns (address);
    function b20Stock() external view returns (address);
    function creator() external view returns (address);
    function feeRecipient() external view returns (address);
    function creatorFeeBps() external view returns (uint256);
    function targetShares() external view returns (uint256);
    function totalSharesAccumulated() external view returns (uint256);
    function isGraduated() external view returns (bool);

    function buy(uint256 b20AmountIn, uint256 minTokensOut, address recipient) external returns (uint256 tokensOut);
    function sell(uint256 tokenAmountIn, uint256 minB20Out, address recipient) external returns (uint256 b20Out);
    function graduate() external;
}

