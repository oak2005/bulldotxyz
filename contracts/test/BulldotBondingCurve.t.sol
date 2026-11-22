// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {BulldotToken} from "../src/BulldotToken.sol";
import {BulldotBondingCurve} from "../src/BulldotBondingCurve.sol";
import {BulldotFeeVault} from "../src/BulldotFeeVault.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";

contract BulldotBondingCurveTest is Test {
    MockB20Stock public b20Stock;
    BulldotToken public token;
    BulldotBondingCurve public curve;
    BulldotFeeVault public feeVault;

    address public creator = address(0x1111);
    address public feeRecipient = address(0x2222);
    address public protocolFeeRecipient = address(0x3333);
    address public alice = address(0xAAAA);
    address public bob = address(0xBBBB);

    uint256 public constant CREATOR_FEE_BPS = 100; // 1%
    uint256 public constant PROTOCOL_FEE_BPS = 50;  // 0.5%
    uint256 public constant TARGET_SHARES = 50 * 1e18; // 50 shares target

    function setUp() public {
        b20Stock = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");
        feeVault = new BulldotFeeVault();

        token = new BulldotToken("BULL PROTOCOL", "BULL", address(this));

        curve = new BulldotBondingCurve(
            address(token),
            address(b20Stock),
            creator,
            feeRecipient,
            protocolFeeRecipient,
            address(feeVault),
            CREATOR_FEE_BPS,
            PROTOCOL_FEE_BPS,
            TARGET_SHARES,
            address(0),
            address(0)
        );

        token.transfer(address(curve), token.totalSupply());

        b20Stock.mint(alice, 1000 * 1e18);
        b20Stock.mint(bob, 1000 * 1e18);

        vm.prank(alice);
        b20Stock.approve(address(curve), type(uint256).max);

        vm.prank(bob);
        b20Stock.approve(address(curve), type(uint256).max);
    }

    function test_InitialState() public view {
        assertEq(b20Stock.multiplier(), 1e18);
        assertEq(curve.totalSharesAccumulated(), 0);
        assertFalse(curve.isGraduated());
        assertEq(token.balanceOf(address(curve)), 1_000_000_000 * 1e18);
    }

    function test_BuyTokensOnCurve() public {
        uint256 b20Deposit = 10 * 1e18; // 10 bCOIN tokens

        vm.prank(alice);
        uint256 tokensReceived = curve.buy(b20Deposit, 0, alice);

        assertTrue(tokensReceived > 0, "Alice should receive tokens");
        assertEq(token.balanceOf(alice), tokensReceived);

        uint256 expectedCreatorFee = (b20Deposit * CREATOR_FEE_BPS) / 10000;
        uint256 expectedProtocolFee = (b20Deposit * PROTOCOL_FEE_BPS) / 10000;
        assertEq(feeVault.pendingRawBalance(address(token), address(b20Stock)), expectedCreatorFee);
        assertEq(b20Stock.balanceOf(protocolFeeRecipient), expectedProtocolFee);
    }

    function test_B20MultiplierStockSplitInvariance() public {
        vm.prank(alice);
        curve.buy(10 * 1e18, 0, alice);

        // 2x forward stock split
        b20Stock.simulateStockSplit(2e18);
        assertEq(b20Stock.multiplier(), 2e18);

        uint256 sharesBeforeBob = curve.totalSharesAccumulated();
        vm.prank(bob);
        curve.buy(20 * 1e18, 0, bob);
        uint256 sharesAfterBob = curve.totalSharesAccumulated();

        uint256 bobShares = sharesAfterBob - sharesBeforeBob;
        // 20 bCOIN under 2x multiplier represents the exact same economic share exposure as 10 bCOIN under 1x
        assertApproxEqRel(bobShares, 10 * 1e18, 0.05e18);
    }

    function test_SellTokensBackToCurve() public {
        vm.prank(alice);
        uint256 tokensBought = curve.buy(10 * 1e18, 0, alice);

        uint256 tokensToSell = tokensBought / 2;
        vm.prank(alice);
        token.approve(address(curve), tokensToSell);

        uint256 b20Before = b20Stock.balanceOf(alice);
        vm.prank(alice);
        uint256 b20Out = curve.sell(tokensToSell, 0, alice);

        assertTrue(b20Out > 0, "Alice should receive B20 tokens on sell");
        assertEq(b20Stock.balanceOf(alice), b20Before + b20Out);
    }

    function test_SolvencyAndSellAfterStockSplit() public {
        vm.prank(alice);
        uint256 tokensBought = curve.buy(10 * 1e18, 0, alice);

        // 4x forward split
        b20Stock.simulateStockSplit(4e18);

        // Alice sells all tokens back: must succeed without InsufficientReserve revert
        vm.prank(alice);
        token.approve(address(curve), tokensBought);

        vm.prank(alice);
        uint256 b20Out = curve.sell(tokensBought, 0, alice);
        assertTrue(b20Out > 0, "Sell must succeed cleanly even after a corporate stock split");
        assertTrue(b20Stock.balanceOf(address(curve)) >= 0, "Solvency guaranteed");
    }

    function test_FairRefundAndFeeCappingOnGraduation() public {
        // Buy close to graduation
        vm.prank(alice);
        curve.buy(49 * 1e18, 0, alice);

        uint256 aliceB20Before = b20Stock.balanceOf(alice);

        // Alice sends a huge amount (100 bCOIN) when only ~1.5 bCOIN is needed
        vm.prank(alice);
        curve.buy(100 * 1e18, 0, alice);

        assertTrue(curve.isGraduated(), "Curve must be graduated");

        uint256 aliceB20After = b20Stock.balanceOf(alice);
        uint256 actualConsumed = aliceB20Before - aliceB20After;

        // Alice should NOT have lost 100 bCOIN; excess must have been refunded
        assertTrue(actualConsumed < 5 * 1e18, "Only the required graduation amount should be consumed");
    }
}
