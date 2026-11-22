// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {BulldotToken} from "../src/BulldotToken.sol";
import {BulldotBondingCurve} from "../src/BulldotBondingCurve.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";

contract BulldotBondingCurveTest is Test {
    MockB20Stock public b20Stock;
    BulldotToken public token;
    BulldotBondingCurve public curve;

    address public creator = address(0x1111);
    address public feeRecipient = address(0x2222);
    address public protocolFeeRecipient = address(0x3333);
    address public alice = address(0xAAAA);
    address public bob = address(0xBBBB);

    uint256 public constant CREATOR_FEE_BPS = 100; // 1%
    uint256 public constant PROTOCOL_FEE_BPS = 50;  // 0.5%
    uint256 public constant TARGET_SHARES = 50 * 1e18; // 50 shares target

    function setUp() public {
        // 1. Deploy Mock B20 Stock (e.g. bCOIN)
        b20Stock = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");

        // 2. Deploy Token with recipient = address(this)
        token = new BulldotToken("BULL PROTOCOL", "BULL", address(this));

        // 3. Deploy Curve with genuine token address
        curve = new BulldotBondingCurve(
            address(token),
            address(b20Stock),
            creator,
            feeRecipient,
            protocolFeeRecipient,
            CREATOR_FEE_BPS,
            PROTOCOL_FEE_BPS,
            TARGET_SHARES,
            address(0), // PoolManager mock/dummy
            address(0)  // PositionManager mock/dummy
        );

        // 4. Fund curve with 100% of token supply
        token.transfer(address(curve), token.totalSupply());

        // Fund test users with B20 stock tokens
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

        // Check fees distributed
        uint256 expectedCreatorFee = (b20Deposit * CREATOR_FEE_BPS) / 10000;
        uint256 expectedProtocolFee = (b20Deposit * PROTOCOL_FEE_BPS) / 10000;
        assertEq(b20Stock.balanceOf(feeRecipient), expectedCreatorFee);
        assertEq(b20Stock.balanceOf(protocolFeeRecipient), expectedProtocolFee);
    }

    function test_B20MultiplierStockSplitInvariance() public {
        // Step 1: Alice buys with 10 b20 tokens when multiplier is 1.0x (10 tokens = 10 shares)
        vm.prank(alice);
        curve.buy(10 * 1e18, 0, alice);
        uint256 accumulatedSharesBefore = curve.totalSharesAccumulated();

        // Step 2: Stock Split occurs on-chain! Multiplier changes to 2.0x (2 tokens = 1 share)
        b20Stock.setMultiplier(2e18);
        assertEq(b20Stock.multiplier(), 2e18);

        // Bob buys with 20 b20 tokens (which equals exactly 10 shares under 2.0x multiplier)
        vm.prank(bob);
        curve.buy(20 * 1e18, 0, bob);
        uint256 accumulatedSharesAfter = curve.totalSharesAccumulated();

        // The additional accumulated shares from Bob's 20 tokens should be approximately equal
        // to Alice's 10 tokens before the split because shares = (tokens * 1e18) / multiplier
        uint256 bobShares = accumulatedSharesAfter - accumulatedSharesBefore;
        assertApproxEqRel(bobShares, accumulatedSharesBefore, 0.01e18); // within 1%
    }

    function test_SellTokensBackToCurve() public {
        // Alice buys tokens
        vm.prank(alice);
        uint256 tokensBought = curve.buy(10 * 1e18, 0, alice);

        // Alice sells half of them back
        uint256 tokensToSell = tokensBought / 2;
        vm.prank(alice);
        token.approve(address(curve), tokensToSell);

        uint256 b20Before = b20Stock.balanceOf(alice);
        vm.prank(alice);
        uint256 b20Out = curve.sell(tokensToSell, 0, alice);

        assertTrue(b20Out > 0, "Alice should receive B20 tokens on sell");
        assertEq(b20Stock.balanceOf(alice), b20Before + b20Out);
    }
}

