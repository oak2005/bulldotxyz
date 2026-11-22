// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {BulldotBondingCurve} from "../src/BulldotBondingCurve.sol";
import {BulldotToken} from "../src/BulldotToken.sol";
import {BulldotFeeVault} from "../src/BulldotFeeVault.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";
import {MockB20Registry} from "../src/mocks/MockB20Registry.sol";
import {MockUniswapV4PoolManager} from "../src/mocks/MockUniswapV4PoolManager.sol";
import {IBulldotFactory} from "../src/interfaces/IBulldotFactory.sol";

contract BulldotFeeSystemTest is Test {
    BulldotFactory public factory;
    BulldotFeeVault public feeVault;
    MockB20Registry public b20Registry;
    MockUniswapV4PoolManager public poolManager;
    MockB20Stock public bCOIN;
    MockB20Stock public bNVDA;

    address public owner = address(0xAAAA);
    address public creator = address(0xBBBB);
    address public initialFeeRecipient = address(0xCCCC);
    address public stockTreasury = address(0xDDDD);
    address public buyer = address(0xEEEE);

    function setUp() public {
        vm.startPrank(owner);

        poolManager = new MockUniswapV4PoolManager();
        bCOIN = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");
        bNVDA = new MockB20Stock("Nvidia Tokenized Stock", "bNVDA");

        feeVault = new BulldotFeeVault();
        b20Registry = new MockB20Registry();

        // Register bCOIN in official B20 Registry pattern
        b20Registry.registerStock(address(bCOIN), "COIN", "US19260Q1076", address(0));

        // Deploy Factory with B20 Registry integration
        address[] memory emptyAllowlist = new address[](0);
        factory = new BulldotFactory(
            address(poolManager),
            address(0),
            owner,
            address(feeVault),
            address(b20Registry),
            emptyAllowlist
        );

        vm.stopPrank();

        // Mint stocks to creator and buyer
        bCOIN.mint(creator, 500 * 1e18);
        bCOIN.mint(buyer, 500 * 1e18);
        bNVDA.mint(creator, 500 * 1e18);

        vm.startPrank(creator);
        bCOIN.approve(address(factory), type(uint256).max);
        bNVDA.approve(address(factory), type(uint256).max);
        vm.stopPrank();
    }

    function test_OfficialB20RegistryPattern() public view {
        // bCOIN is registered in the official registry -> accepted
        assertTrue(factory.isVerifiedB20Stock(address(bCOIN)));

        // bNVDA is not yet registered in registry -> rejected
        assertFalse(factory.isVerifiedB20Stock(address(bNVDA)));
    }

    function test_FeeRedirectionToStockTreasury() public {
        uint16 creatorFeeBps = 200; // 2%
        uint256 initialB20 = 20 * 1e18; // 20 bCOIN

        // 1. Launch Instant Pool
        IBulldotFactory.InstantPoolParams memory params = IBulldotFactory.InstantPoolParams({
            name: "Treasury Share Token",
            symbol: "TST",
            b20Stock: address(bCOIN),
            b20Amount: initialB20,
            feeRecipient: initialFeeRecipient,
            creatorFeeBps: creatorFeeBps
        });

        vm.prank(creator);
        (address tokenAddr, ) = factory.createInstantPool(params);

        // Verify initial fee delivered to initialFeeRecipient
        uint256 expectedCreatorFee = (initialB20 * creatorFeeBps) / 10_000;
        assertEq(bCOIN.balanceOf(initialFeeRecipient), expectedCreatorFee);

        // 2. Creator redirects future fees to the Stock Treasury
        vm.prank(creator);
        feeVault.redirectFeeRecipient(tokenAddr, stockTreasury);
        assertEq(feeVault.feeRecipients(tokenAddr), stockTreasury);

        // 3. Deposit a subsequent fee (e.g. from volume / secondary action)
        bCOIN.mint(address(this), 10 * 1e18);
        bCOIN.approve(address(feeVault), type(uint256).max);

        uint256 treasuryBefore = bCOIN.balanceOf(stockTreasury);
        feeVault.depositFee(tokenAddr, address(bCOIN), 5 * 1e18, true);

        // 4. Verify stock treasury received the redirected fee directly
        assertEq(bCOIN.balanceOf(stockTreasury), treasuryBefore + 5 * 1e18);
    }

    function test_TransparentOnChainFeeTrackingWithMultiplier() public {
        uint16 creatorFeeBps = 100; // 1%

        // 1. Launch Bonding Curve
        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Transparent Fee Token",
            symbol: "TFT",
            b20Stock: address(bCOIN),
            feeRecipient: initialFeeRecipient,
            creatorFeeBps: creatorFeeBps
        });

        vm.prank(creator);
        (address tokenAddr, address curveAddr) = factory.createBondingCurve(params);
        BulldotBondingCurve curve = BulldotBondingCurve(curveAddr);

        // 2. Buyer buys 10 bCOIN tokens before any split (Multiplier = 1.0x)
        vm.startPrank(buyer);
        bCOIN.approve(curveAddr, type(uint256).max);
        curve.buy(10 * 1e18, 0, buyer);
        vm.stopPrank();

        uint256 fee1 = (10 * 1e18 * uint256(creatorFeeBps)) / 10_000;

        // Query transparent metrics from FeeVault
        (
            uint256 rawReceived1,
            uint256 sharesReceived1,
            ,
            uint256 pending1,
            uint256 mult1
        ) = feeVault.getFeeMetrics(tokenAddr, address(bCOIN));

        assertEq(rawReceived1, fee1);
        assertEq(sharesReceived1, fee1); // 1 token = 1 share at 1.0x
        assertEq(pending1, fee1);
        assertEq(mult1, 1e18);

        // 3. Corporate Action: 2-for-1 forward stock split on Coinbase stock
        bCOIN.simulateStockSplit(2e18);
        assertEq(bCOIN.multiplier(), 2e18);

        // 4. Buyer buys 20 bCOIN tokens after split (which is 10 shares in economic terms)
        vm.prank(buyer);
        curve.buy(20 * 1e18, 0, buyer);

        uint256 fee2 = (20 * 1e18 * uint256(creatorFeeBps)) / 10_000;

        (
            uint256 rawReceived2,
            uint256 sharesReceived2,
            ,
            ,
            uint256 mult2
        ) = feeVault.getFeeMetrics(tokenAddr, address(bCOIN));

        assertEq(rawReceived2, fee1 + fee2);
        // Under 2x multiplier, fee2 tokens (0.2 tokens) equal 0.1 shares (fee1 shares)
        assertEq(sharesReceived2, fee1 + (fee2 * 1e18 / 2e18));
        assertEq(mult2, 2e18);
    }

    function test_ZeroAdminInterventionForFeeClaiming() public {
        address token = address(0x999);
        vm.prank(creator);
        feeVault.registerToken(token, creator, creator);

        // Deposit fee into accumulate mode (autoForward = false)
        bCOIN.mint(address(this), 50 * 1e18);
        bCOIN.approve(address(feeVault), type(uint256).max);
        feeVault.depositFee(token, address(bCOIN), 50 * 1e18, false);

        assertEq(feeVault.pendingRawBalance(token, address(bCOIN)), 50 * 1e18);

        // Non-recipient cannot claim
        vm.prank(buyer);
        vm.expectRevert(BulldotFeeVault.Unauthorized.selector);
        feeVault.claimFees(token, address(bCOIN));

        // Creator claims independently without admin approval
        uint256 creatorBefore = bCOIN.balanceOf(creator);
        vm.prank(creator);
        uint256 claimed = feeVault.claimFees(token, address(bCOIN));

        assertEq(claimed, 50 * 1e18);
        assertEq(bCOIN.balanceOf(creator), creatorBefore + 50 * 1e18);
        assertEq(feeVault.pendingRawBalance(token, address(bCOIN)), 0);
    }
}

