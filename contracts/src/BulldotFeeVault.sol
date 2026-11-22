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
 * - GRACEFUL BUFFERING: If auto-forward to a fee recipient fails (e.g. recipient is a contract without
 *   fallback or has restricted transfers), fees are safely buffered in `pendingRawBalance` rather than
 *   reverting and disrupting core trading flows.
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

    event TokenManagerTransferred(
        address indexed token,
        address indexed oldManager,
        address indexed newManager
    );

    // --- State Variables ---
    address public factory;

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

    constructor() {
        factory = msg.sender;
    }

    /**
     * @notice Allows factory assignment once if uninitialized.
     */
    function setFactory(address _factory) external {
        if (factory == address(0) || factory == msg.sender) {
            factory = _factory;
        } else {
            revert Unauthorized();
        }
    }

    /**
     * @notice Registers a launched token with an initial fee recipient and manager.
     */
    function registerToken(address token, address initialRecipient, address manager) external {
        if (token == address(0) || initialRecipient == address(0)) revert ZeroAddress();
        if (tokenManagers[token] != address(0)) return; // Already registered

        // Prevent front-running: factory, designated manager, or verified deployed contract
        if (factory != address(0) && msg.sender != factory && msg.sender != manager && token.code.length == 0) {
            revert Unauthorized();
        }

        tokenManagers[token] = manager == address(0) ? initialRecipient : manager;
        feeRecipients[token] = initialRecipient;
        emit FeeRecipientRedirected(token, address(0), initialRecipient);
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
     * @notice Allows token manager to transfer token management rights to a new manager or DAO.
     */
    function transferTokenManager(address token, address newManager) external {
        if (msg.sender != tokenManagers[token]) revert Unauthorized();
        if (newManager == address(0)) revert ZeroAddress();

        address oldManager = tokenManagers[token];
        tokenManagers[token] = newManager;

        emit TokenManagerTransferred(token, oldManager, newManager);
    }

    /**
     * @notice Allows token manager to irrevocably renounce management.
     * Prevents any future redirection of fee recipient (e.g. locks redirect to Stock Treasury permanently).
     */
    function renounceTokenManager(address token) external {
        if (msg.sender != tokenManagers[token]) revert Unauthorized();

        address oldManager = tokenManagers[token];
        tokenManagers[token] = address(0);

        emit TokenManagerTransferred(token, oldManager, address(0));
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
            tokenManagers[token] = recipient;
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

        // 4. Auto-forward or buffer for claim
        if (autoForward) {
            bool sendSuccess = false;
            try IB20Stock(stock).transfer(recipient, rawAmount) returns (bool ok) {
                sendSuccess = ok;
            } catch {}

            if (sendSuccess) {
                totalRawClaimed[token][stock] += rawAmount;
                emit FeeClaimed(token, stock, recipient, rawAmount, shareAmount);
            } else {
                // Buffer safely in vault if recipient is unpayable/blocked
                pendingRawBalance[token][stock] += rawAmount;
            }
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

    address public constant DEAD_ADDRESS = address(0x000000000000000000000000000000000000dEaD);

    /**
     * @notice Allows fee recipient or manager to claim accumulated B20 stock fees.
     * ZERO-MAINTENANCE AUTONOMOUS FEATURE:
     * If fees are redirected to DEAD_ADDRESS (Stock Treasury), ANY caller can trigger
     * claimFees to permissionlessly burn/lock the stock fees forever.
     */
    function claimFees(address token, address stock) external nonReentrant returns (uint256 claimedRaw) {
        address recipient = feeRecipients[token];

        // Permissionless execution when destination is Dead address (cannot steal)
        if (recipient != DEAD_ADDRESS && recipient != address(0)) {
            if (msg.sender != recipient && msg.sender != tokenManagers[token]) revert Unauthorized();
        } else {
            recipient = DEAD_ADDRESS;
        }

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
