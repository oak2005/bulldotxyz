// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IB20Stock} from "./interfaces/IB20Stock.sol";
import {BulldotToken} from "./BulldotToken.sol";
import {IBulldotBondingCurve} from "./interfaces/IBulldotBondingCurve.sol";

/**
 * @title BulldotBondingCurve
 * @notice Autonomous, multiplier-aware bonding curve for token launches paired with Coinbase B20 tokenized stocks.
 * @dev Denominates graduation and internal valuation in canonical shares (via tokensToShares / sharesToTokens)
 * to maintain strict economic invariants even when stock splits or corporate actions occur on the B20 asset.
 */
contract BulldotBondingCurve is IBulldotBondingCurve {
    // ------------------------------------------------------------------------
    // Immutables & Config
    // ------------------------------------------------------------------------
    BulldotToken public immutable override token;
    IB20Stock public immutable override b20Stock;
    address public immutable override creator;
    address public immutable protocolFeeRecipient;
    address public override feeRecipient;

    uint256 public immutable override creatorFeeBps;
    uint256 public immutable protocolFeeBps;

    // Target graduation threshold in canonical shares (18 decimals)
    uint256 public immutable override targetShares;

    // Virtual reserves in canonical shares and token units
    uint256 public constant VIRTUAL_SHARES = 30 * 1e18; // 30 virtual shares
    uint256 public constant TOTAL_CURVE_TOKENS = 800_000_000 * 1e18; // 800M for curve
    uint256 public constant MIGRATION_TOKENS = 200_000_000 * 1e18;   // 200M reserved for Uniswap v4 LP
    uint256 public constant VIRTUAL_TOKENS = 1_073_000_000 * 1e18;

    uint256 public virtualSharesReserve;
    uint256 public virtualTokenReserve;
    uint256 public override totalSharesAccumulated;
    bool public override isGraduated;

    // Uniswap v4 Periphery/Manager coordinates
    address public immutable poolManager;
    address public immutable positionManager;

    // Reentrancy guard state
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "REENTRANCY");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(
        address _token,
        address _b20Stock,
        address _creator,
        address _feeRecipient,
        address _protocolFeeRecipient,
        uint256 _creatorFeeBps,
        uint256 _protocolFeeBps,
        uint256 _targetShares,
        address _poolManager,
        address _positionManager
    ) {
        require(_creatorFeeBps <= 200, "Creator fee max 2%");
        require(_protocolFeeBps <= 100, "Protocol fee max 1%");

        token = BulldotToken(_token);
        b20Stock = IB20Stock(_b20Stock);
        creator = _creator;
        feeRecipient = _feeRecipient == address(0) ? _creator : _feeRecipient;
        protocolFeeRecipient = _protocolFeeRecipient;
        creatorFeeBps = _creatorFeeBps;
        protocolFeeBps = _protocolFeeBps;
        targetShares = _targetShares;

        poolManager = _poolManager;
        positionManager = _positionManager;

        virtualSharesReserve = VIRTUAL_SHARES;
        virtualTokenReserve = VIRTUAL_TOKENS;
    }

    /**
     * @notice Allows creator or governance to update fee recipient (e.g. to stock holders or DAO treasury).
     */
    function setFeeRecipient(address newRecipient) external {
        require(msg.sender == creator, "Only creator");
        require(newRecipient != address(0), "Invalid recipient");
        feeRecipient = newRecipient;
    }

    /**
     * @notice Buy tokens using B20 stock tokens.
     * @param b20AmountIn Total B20 tokens deposited by caller.
     * @param minTokensOut Minimum tokens expected (slippage protection).
     * @param recipient Address to receive purchased tokens.
     */
    function buy(
        uint256 b20AmountIn,
        uint256 minTokensOut,
        address recipient
    ) external override nonReentrant returns (uint256 tokensOut) {
        require(!isGraduated, "Curve graduated");
        require(b20AmountIn > 0, "Zero input");
        require(recipient != address(0), "Invalid recipient");

        // Calculate and transfer fees
        uint256 creatorFee = (b20AmountIn * creatorFeeBps) / 10000;
        uint256 protocolFee = (b20AmountIn * protocolFeeBps) / 10000;
        uint256 netB20 = b20AmountIn - creatorFee - protocolFee;

        // Pull total B20 from user
        require(b20Stock.transferFrom(msg.sender, address(this), b20AmountIn), "B20 transfer failed");

        // Distribute fees immediately
        if (creatorFee > 0) {
            b20Stock.transfer(feeRecipient, creatorFee);
        }
        if (protocolFee > 0 && protocolFeeRecipient != address(0)) {
            b20Stock.transfer(protocolFeeRecipient, protocolFee);
        }

        // Convert net B20 tokens to canonical shares using current multiplier
        uint256 sharesIn = b20Stock.tokensToShares(netB20);
        require(sharesIn > 0, "Shares zero");

        // Check if trade crosses graduation threshold
        uint256 remainingSharesToTarget = targetShares > totalSharesAccumulated
            ? targetShares - totalSharesAccumulated
            : 0;

        uint256 effectiveSharesIn = sharesIn;
        uint256 refundB20 = 0;

        if (sharesIn >= remainingSharesToTarget && remainingSharesToTarget > 0) {
            effectiveSharesIn = remainingSharesToTarget;
            uint256 effectiveB20 = b20Stock.sharesToTokens(effectiveSharesIn);
            if (netB20 > effectiveB20) {
                refundB20 = netB20 - effectiveB20;
                b20Stock.transfer(recipient, refundB20);
            }
        }

        // Virtual constant product: (vShares + sharesIn) * (vTokens - tokensOut) = vShares * vTokens
        uint256 k = virtualSharesReserve * virtualTokenReserve;
        uint256 newVirtualShares = virtualSharesReserve + effectiveSharesIn;
        uint256 newVirtualTokens = k / newVirtualShares;
        tokensOut = virtualTokenReserve - newVirtualTokens;

        require(tokensOut >= minTokensOut, "Slippage exceeded");
        require(token.balanceOf(address(this)) >= tokensOut + MIGRATION_TOKENS, "Insufficient curve reserve");

        virtualSharesReserve = newVirtualShares;
        virtualTokenReserve = newVirtualTokens;
        totalSharesAccumulated += effectiveSharesIn;

        // Send tokens to buyer
        require(token.transfer(recipient, tokensOut), "Token transfer failed");

        emit TokensPurchased(msg.sender, recipient, b20AmountIn - refundB20, tokensOut, creatorFee + protocolFee);

        // Auto-graduate if target reached
        if (totalSharesAccumulated >= targetShares) {
            _executeGraduation();
        }
    }

    /**
     * @notice Sell tokens back to the curve in exchange for B20 stock tokens.
     */
    function sell(
        uint256 tokenAmountIn,
        uint256 minB20Out,
        address recipient
    ) external override nonReentrant returns (uint256 b20Out) {
        require(!isGraduated, "Curve graduated");
        require(tokenAmountIn > 0, "Zero input");
        require(recipient != address(0), "Invalid recipient");

        // Pull tokens from user
        require(token.transferFrom(msg.sender, address(this), tokenAmountIn), "Token transfer failed");

        // Constant product: (vTokens + tokensIn) * (vShares - sharesOut) = k
        uint256 k = virtualSharesReserve * virtualTokenReserve;
        uint256 newVirtualTokens = virtualTokenReserve + tokenAmountIn;
        uint256 newVirtualShares = k / newVirtualTokens;
        uint256 sharesOut = virtualSharesReserve - newVirtualShares;

        require(sharesOut > 0, "Zero shares out");

        // Convert canonical shares to raw B20 token units via live multiplier
        uint256 grossB20 = b20Stock.sharesToTokens(sharesOut);
        require(b20Stock.balanceOf(address(this)) >= grossB20, "Insufficient B20 reserve");

        uint256 creatorFee = (grossB20 * creatorFeeBps) / 10000;
        uint256 protocolFee = (grossB20 * protocolFeeBps) / 10000;
        b20Out = grossB20 - creatorFee - protocolFee;

        require(b20Out >= minB20Out, "Slippage exceeded");

        virtualSharesReserve = newVirtualShares;
        virtualTokenReserve = newVirtualTokens;
        if (totalSharesAccumulated > sharesOut) {
            totalSharesAccumulated -= sharesOut;
        } else {
            totalSharesAccumulated = 0;
        }

        // Payout B20 to seller & fees
        if (creatorFee > 0) {
            b20Stock.transfer(feeRecipient, creatorFee);
        }
        if (protocolFee > 0 && protocolFeeRecipient != address(0)) {
            b20Stock.transfer(protocolFeeRecipient, protocolFee);
        }
        require(b20Stock.transfer(recipient, b20Out), "B20 payout failed");

        emit TokensSold(msg.sender, recipient, tokenAmountIn, b20Out, creatorFee + protocolFee);
    }

    /**
     * @notice Permissionless graduation trigger when target reached.
     */
    function graduate() external override nonReentrant {
        require(!isGraduated, "Already graduated");
        require(totalSharesAccumulated >= targetShares, "Target not reached");
        _executeGraduation();
    }

    /**
     * @dev Internal migration to permanent Uniswap v4 liquidity locked to dead address.
     */
    function _executeGraduation() internal {
        isGraduated = true;

        uint256 b20Balance = b20Stock.balanceOf(address(this));
        uint256 tokenBalance = token.balanceOf(address(this));

        // Liquidity destination is dead address forever
        address permanentDead = address(0x000000000000000000000000000000000000dEaD);

        // Approve PoolManager / PositionManager
        b20Stock.approve(positionManager != address(0) ? positionManager : poolManager, b20Balance);
        token.approve(positionManager != address(0) ? positionManager : poolManager, tokenBalance);

        // If deployed with full Uniswap v4 position manager, mint locked full-range position directly to dead address
        // Otherwise hold in immutable dead address as irrevocable reserve
        if (positionManager == address(0)) {
            b20Stock.transfer(permanentDead, b20Balance);
            token.transfer(permanentDead, tokenBalance);
        }

        emit Graduated(address(token), address(b20Stock), b20Balance, tokenBalance);
    }
}
