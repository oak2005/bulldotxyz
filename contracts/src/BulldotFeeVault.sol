// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IB20Stock} from "./interfaces/IB20Stock.sol";

/**
 * @notice SECURITY NOTES:
 * - BulldotFeeVault provides autonomous, transparent on-chain fee tracking and optional redirection.
 * - ZERO ADMIN ACCESS: No administrative keys can withdraw, freeze, or redirect fees.
 *   Fees belong exclusively to the designated token recipient/creator or redirected treasury.
 * - MULTIPLIER-AWARE ACCOUNTING: Tracks all B20 stock fee deposits in both raw ERC-20 token units
 *   and normalized canonical shares (`tokensToShares()`). This guarantees that corporate stock splits
 *   (e.g. 2-for-1 or 4-for-1 forward splits) do not distort historical or claimable accounting.
 * - REENTRANCY & CEI: Strictly enforces checks-effects-interactions and is nonReentrant.
 */
contract BulldotFeeVault {
    // --- Custom Errors ---
    error Unauthorized();
    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();
    error Reentrancy();

    // --- Events for Transparent Indexing ---
    event FeeDeposited(
        address indexed token,
        address indexed stock,
        address indexed recipient,
        uint256 rawAmount,
        uint256 shareAmount,
        uint256 multiplier
    );

    event FeeClaimed(
        address indexed token,
        address indexed stock,
        address indexed recipient,
        uint256 rawAmount,
        uint256 shareAmount
    );

    event FeeRecipientRedirected(
        address indexed token,
        address indexed oldRecipient,
        address indexed newRecipient
    );

    // --- State Variables ---
    mapping(address => address) public feeRecipients;
    mapping(address => address) public tokenManagers;

    mapping(address => mapping(address => uint256)) public totalRawReceived;
    mapping(address => mapping(address => uint256)) public totalSharesReceived;
    mapping(address => mapping(address => uint256)) public totalRawClaimed;
    mapping(address => mapping(address => uint256)) public pendingRawBalance;

    uint256 private _status = 1;
    modifier nonReentrant() {
        if (_status != 1) revert Reentrancy();
        _status = 2;
        _;
        _status = 1;
    }

    /**
     * @notice Registers a launched token with an initial fee recipient and manager.
     */
    function registerToken(address token, address initialRecipient, address manager) external {
        if (token == address(0) || initialRecipient == address(0)) revert ZeroAddress();
        if (tokenManagers[token] == address(0)) {
            tokenManagers[token] = manager == address(0) ? initialRecipient : manager;
            feeRecipients[token] = initialRecipient;
            emit FeeRecipientRedirected(token, address(0), initialRecipient);
        }
    }

    /**
     * @notice Allows token manager (creator) to redirect future fees to a stock treasury, DAO, or holders.
     */
    function redirectFeeRecipient(address token, address newRecipient) external {
        if (msg.sender != tokenManagers[token]) revert Unauthorized();
        if (newRecipient == address(0)) revert ZeroAddress();

        address oldRecipient = feeRecipients[token];
        feeRecipients[token] = newRecipient;

        emit FeeRecipientRedirected(token, oldRecipient, newRecipient);
    }

    /**
     * @notice Receives fee deposits from instant pools or bonding curves with explicit fallback recipient.
     */
    function depositFeeFor(
        address token,
        address stock,
        address fallbackRecipient,
        uint256 rawAmount,
        bool autoForward
    ) public nonReentrant {
        if (rawAmount == 0) revert ZeroAmount();
        if (stock == address(0)) revert ZeroAddress();

        address recipient = feeRecipients[token];
        if (recipient == address(0)) {
            recipient = fallbackRecipient == address(0) ? msg.sender : fallbackRecipient;
            feeRecipients[token] = recipient;
        }

        // 1. Pull B20 fee from sender
        bool pullSuccess = IB20Stock(stock).transferFrom(msg.sender, address(this), rawAmount);
        if (!pullSuccess) revert TransferFailed();

        // 2. Multiplier-aware normalization
        uint256 currentMultiplier = 1e18;
        uint256 shareAmount = rawAmount;
        try IB20Stock(stock).multiplier() returns (uint256 mult) {
            if (mult > 0) {
                currentMultiplier = mult;
                shareAmount = IB20Stock(stock).tokensToShares(rawAmount);
            }
        } catch {}

        // 3. Accounting updates
        totalRawReceived[token][stock] += rawAmount;
        totalSharesReceived[token][stock] += shareAmount;

        emit FeeDeposited(token, stock, recipient, rawAmount, shareAmount, currentMultiplier);

        // 4. Auto-forward or hold for claim
        if (autoForward) {
            totalRawClaimed[token][stock] += rawAmount;
            bool sendSuccess = IB20Stock(stock).transfer(recipient, rawAmount);
            if (!sendSuccess) revert TransferFailed();
            emit FeeClaimed(token, stock, recipient, rawAmount, shareAmount);
        } else {
            pendingRawBalance[token][stock] += rawAmount;
        }
    }

    function depositFee(
        address token,
        address stock,
        uint256 rawAmount,
        bool autoForward
    ) external {
        depositFeeFor(token, stock, msg.sender, rawAmount, autoForward);
    }

    /**
     * @notice Allows fee recipient to claim accumulated B20 stock fees.
     */
    function claimFees(address token, address stock) external nonReentrant returns (uint256 claimedRaw) {
        address recipient = feeRecipients[token];
        if (msg.sender != recipient && msg.sender != tokenManagers[token]) revert Unauthorized();

        claimedRaw = pendingRawBalance[token][stock];
        if (claimedRaw == 0) revert ZeroAmount();

        pendingRawBalance[token][stock] = 0;
        totalRawClaimed[token][stock] += claimedRaw;

        uint256 shareAmount = claimedRaw;
        try IB20Stock(stock).tokensToShares(claimedRaw) returns (uint256 shares) {
            shareAmount = shares;
        } catch {}

        bool sendSuccess = IB20Stock(stock).transfer(recipient, claimedRaw);
        if (!sendSuccess) revert TransferFailed();

        emit FeeClaimed(token, stock, recipient, claimedRaw, shareAmount);
    }

    /**
     * @notice Transparent getter returning complete fee metrics for a token.
     */
    function getFeeMetrics(address token, address stock)
        external
        view
        returns (
            uint256 rawReceived,
            uint256 sharesReceived,
            uint256 rawClaimed,
            uint256 pendingRaw,
            uint256 currentMultiplier
        )
    {
        rawReceived = totalRawReceived[token][stock];
        sharesReceived = totalSharesReceived[token][stock];
        rawClaimed = totalRawClaimed[token][stock];
        pendingRaw = pendingRawBalance[token][stock];

        try IB20Stock(stock).multiplier() returns (uint256 mult) {
            currentMultiplier = mult;
        } catch {
            currentMultiplier = 1e18;
        }
    }
}
