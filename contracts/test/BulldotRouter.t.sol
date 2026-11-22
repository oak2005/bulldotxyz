// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {BulldotBondingCurve} from "../src/BulldotBondingCurve.sol";
import {BulldotToken} from "../src/BulldotToken.sol";
import {BulldotRouter} from "../src/BulldotRouter.sol";
import {BulldotFeeVault} from "../src/BulldotFeeVault.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";
import {MockUniswapV4PoolManager} from "../src/mocks/MockUniswapV4PoolManager.sol";
import {IBulldotFactory} from "../src/interfaces/IBulldotFactory.sol";

contract BulldotRouterTest is Test {
    BulldotFactory public factory;
    BulldotRouter public router;
    BulldotFeeVault public feeVault;
    MockUniswapV4PoolManager public poolManager;
    MockB20Stock public bCOIN;

    address public owner = address(0xAAAA);
    address public creator = address(0xBBBB);
    address public buyer = address(0xCCCC);

    function setUp() public {
        vm.startPrank(owner);

        poolManager = new MockUniswapV4PoolManager();
        bCOIN = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");
        feeVault = new BulldotFeeVault();

        address[] memory verifiedList = new address[](1);
        verifiedList[0] = address(bCOIN);

        factory = new BulldotFactory(
            address(poolManager),
            address(0),
            owner,
            address(feeVault),
            address(0),
            verifiedList
        );

        router = new BulldotRouter(address(factory), address(poolManager));

        vm.stopPrank();

        bCOIN.mint(buyer, 100 * 1e18);

        vm.prank(buyer);
        bCOIN.approve(address(router), type(uint256).max);
    }

    function test_RouterSwapB20ForTokensOnCurve() public {
        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Router Test Token",
            symbol: "RTT",
            b20Stock: address(bCOIN),
            feeRecipient: creator,
            creatorFeeBps: 100,
            maxWalletBps: 0
        });

        vm.prank(creator);
        (address tokenAddr, address curveAddr) = factory.createBondingCurve(params);

        uint256 b20Deposit = 5 * 1e18; // 5 bCOIN
        vm.prank(buyer);
        uint256 tokensOut = router.swapB20ForTokens(
            curveAddr,
            address(bCOIN),
            b20Deposit,
            0,
            buyer,
            block.timestamp + 300
        );

        assertTrue(tokensOut > 0, "Buyer should receive tokens from router");
        assertEq(BulldotToken(tokenAddr).balanceOf(buyer), tokensOut);
    }

    function test_RouterGetQuote() public {
        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Router Test Token",
            symbol: "RTT",
            b20Stock: address(bCOIN),
            feeRecipient: creator,
            creatorFeeBps: 100,
            maxWalletBps: 0
        });

        vm.prank(creator);
        (, address curveAddr) = factory.createBondingCurve(params);

        uint256 b20Input = 2 * 1e18; // 2 bCOIN
        (uint256 expectedTokensOut, uint256 fee, uint256 priceImpactBps) = router.getQuote(
            curveAddr,
            b20Input,
            false
        );

        assertTrue(expectedTokensOut > 0, "Quote should return positive output");
        assertTrue(fee > 0, "Fee should be non-zero");
        assertTrue(priceImpactBps > 0, "Price impact should be positive for realistic input");
    }

    function test_RouterRevertOnExpiredDeadline() public {
        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Router Test Token",
            symbol: "RTT",
            b20Stock: address(bCOIN),
            feeRecipient: creator,
            creatorFeeBps: 100,
            maxWalletBps: 0
        });

        vm.prank(creator);
        (, address curveAddr) = factory.createBondingCurve(params);

        vm.warp(1000);
        vm.prank(buyer);
        vm.expectRevert(BulldotRouter.Expired.selector);
        router.swapB20ForTokens(
            curveAddr,
            address(bCOIN),
            5 * 1e18,
            0,
            buyer,
            500 // Expired deadline
        );
    }

    function test_RouterSwapViaTokenAddress() public {
        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Token Address Swap",
            symbol: "TAS",
            b20Stock: address(bCOIN),
            feeRecipient: creator,
            creatorFeeBps: 100,
            maxWalletBps: 0
        });

        vm.prank(creator);
        (address tokenAddr, ) = factory.createBondingCurve(params);

        // Buyer passes token address directly instead of curve address
        vm.prank(buyer);
        uint256 tokensOut = router.swapB20ForTokens(
            tokenAddr,
            address(bCOIN),
            3 * 1e18,
            0,
            buyer,
            block.timestamp + 300
        );

        assertTrue(tokensOut > 0, "Buyer should receive tokens using token address");
        assertEq(BulldotToken(tokenAddr).balanceOf(buyer), tokensOut);
    }

    function test_RouterSwapTokensForB20() public {
        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Sell Test Token",
            symbol: "STT",
            b20Stock: address(bCOIN),
            feeRecipient: creator,
            creatorFeeBps: 100,
            maxWalletBps: 0
        });

        vm.prank(creator);
        (address tokenAddr, ) = factory.createBondingCurve(params);

        // First buy
        vm.prank(buyer);
        uint256 tokensBought = router.swapB20ForTokens(
            tokenAddr,
            address(bCOIN),
            5 * 1e18,
            0,
            buyer,
            block.timestamp + 300
        );

        // Now approve and sell half of tokens via router
        uint256 tokensToSell = tokensBought / 2;
        vm.startPrank(buyer);
        BulldotToken(tokenAddr).approve(address(router), type(uint256).max);

        uint256 b20Before = bCOIN.balanceOf(buyer);
        uint256 b20Out = router.swapTokensForB20(
            tokenAddr,
            address(bCOIN),
            tokensToSell,
            0,
            buyer,
            block.timestamp + 300
        );
        vm.stopPrank();

        assertTrue(b20Out > 0, "Buyer should receive B20 on sell");
        assertEq(bCOIN.balanceOf(buyer), b20Before + b20Out);
    }

    function test_RouterRefundOnGraduationOverSubscription() public {
        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Graduation Refund Token",
            symbol: "GRT",
            b20Stock: address(bCOIN),
            feeRecipient: creator,
            creatorFeeBps: 100,
            maxWalletBps: 0
        });

        vm.prank(creator);
        (address tokenAddr, address curveAddr) = factory.createBondingCurve(params);

        // Buyer buys 49 bCOIN (near graduation)
        vm.prank(buyer);
        router.swapB20ForTokens(
            tokenAddr,
            address(bCOIN),
            49 * 1e18,
            0,
            buyer,
            block.timestamp + 300
        );

        // Buyer sends 100 bCOIN to trigger graduation (only ~1.5 bCOIN needed)
        bCOIN.mint(buyer, 100 * 1e18);
        uint256 buyerB20Before = bCOIN.balanceOf(buyer);

        vm.prank(buyer);
        router.swapB20ForTokens(
            tokenAddr,
            address(bCOIN),
            100 * 1e18,
            0,
            buyer,
            block.timestamp + 300
        );

        assertTrue(BulldotBondingCurve(curveAddr).isGraduated(), "Curve must be graduated");
        uint256 buyerB20After = bCOIN.balanceOf(buyer);
        uint256 actualConsumed = buyerB20Before - buyerB20After;

        // Buyer must NOT lose 100 bCOIN: excess was refunded by router
        assertTrue(actualConsumed < 5 * 1e18, "Router must refund excess graduation capital");
    }
}

