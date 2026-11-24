// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BulldotBondingCurve} from "./BulldotBondingCurve.sol";

/**
 * @notice Stateless deployment helper that isolates BulldotBondingCurve creation bytecode
 *         from BulldotFactory so all core contracts remain well under EIP-170 (24,576 bytes).
 * @dev Holds no mutable state, funds, or administrative privileges.
 */
contract BulldotCurveDeployer {
    struct CurveParams {
        address token;
        address b20Stock;
        address creator;
        address feeRecipient;
        address protocolFeeRecipient;
        address feeVault;
        uint256 creatorFeeBps;
        uint256 protocolFeeBps;
        uint256 targetShares;
        uint256 maxWalletBps;
        address poolManager;
        address positionManager;
    }

    /**
     * @notice Deploys an immutable BulldotBondingCurve instance for the caller.
     */
    function deployCurve(CurveParams calldata p) external returns (address) {
        return address(
            new BulldotBondingCurve(
                p.token,
                p.b20Stock,
                p.creator,
                p.feeRecipient,
                p.protocolFeeRecipient,
                p.feeVault,
                p.creatorFeeBps,
                p.protocolFeeBps,
                p.targetShares,
                p.maxWalletBps,
                p.poolManager,
                p.positionManager
            )
        );
    }
}

