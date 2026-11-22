// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {BulldotBondingCurve} from "../src/BulldotBondingCurve.sol";
import {BulldotToken} from "../src/BulldotToken.sol";
import {BulldotFeeVault} from "../src/BulldotFeeVault.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";
import {MockUniswapV4PoolManager} from "../src/mocks/MockUniswapV4PoolManager.sol";
import {IBulldotFactory} from "../src/interfaces/IBulldotFactory.sol";
import {PoolId} from "../src/interfaces/IUniswapV4Minimal.sol";

contract BulldotFactoryTest is Test {
    BulldotFactory public factory;
    MockUniswapV4PoolManager public poolManager;
    MockB20Stock public bCOIN;
    MockB20Stock public unverifiedStock;
    BulldotFeeVault public feeVault;

    address public owner = address(0xAAAA);
    address public creator = address(0xBBBB);
    address public feeRecipient = address(0xCCCC);
    address public protocolFeeRecipient = address(0xDDDD);
    address public buyer = address(0xEEEE);

    uint256 public constant INITIAL_B20_DEPOSIT = 10 * 1e18; // 10 bCOIN tokens

    function setUp() public {
        vm.startPrank(owner);

        poolManager = new MockUniswapV4PoolManager();
        bCOIN = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");
        unverifiedStock = new MockB20Stock("Unverified Token", "FAKE");
        feeVault = new BulldotFeeVault();

        address[] memory verifiedList = new address[](1);
        verifiedList[0] = address(bCOIN);

        factory = new BulldotFactory(
            address(poolManager),
            address(0),
            protocolFeeRecipient,
            address(feeVault),
            address(0), // No registry for base factory test
            verifiedList
        );

        vm.stopPrank();

        bCOIN.mint(creator, 500 * 1e18);
        bCOIN.mint(buyer, 500 * 1e18);
        unverifiedStock.mint(creator, 100 * 1e18);

        vm.startPrank(creator);
        bCOIN.approve(address(factory), type(uint256).max);
        unverifiedStock.approve(address(factory), type(uint256).max);
        vm.stopPrank();

        vm.prank(buyer);
        bCOIN.approve(address(factory), type(uint256).max);
    }

    function test_VerifiedStockAllowlist() public view {
        assertTrue(factory.isVerifiedB20Stock(address(bCOIN)));
        assertFalse(factory.isVerifiedB20Stock(address(unverifiedStock)));
    }

    function test_RevertWhenLaunchingWithUnverifiedStock() public {
        IBulldotFactory.InstantPoolParams memory params = IBulldotFactory.InstantPoolParams({
            name: "Test Community Token",
            symbol: "TEST",
            b20Stock: address(unverifiedStock),
            b20Amount: INITIAL_B20_DEPOSIT,
            feeRecipient: feeRecipient,
            creatorFeeBps: 100
        });

        vm.prank(creator);
        vm.expectRevert(BulldotFactory.StockNotVerified.selector);
        factory.createInstantPool(params);
    }

    function test_RevertWhenCreatorFeeExceedsMax() public {
        IBulldotFactory.InstantPoolParams memory params = IBulldotFactory.InstantPoolParams({
            name: "Test Community Token",
            symbol: "TEST",
            b20Stock: address(bCOIN),
            b20Amount: INITIAL_B20_DEPOSIT,
            feeRecipient: feeRecipient,
            creatorFeeBps: 300 // Max is 250 bps (2.5%)
        });

        vm.prank(creator);
        vm.expectRevert(BulldotFactory.CreatorFeeExceedsLimit.selector);
        factory.createInstantPool(params);
    }

    function test_InstantPoolCreationSuccess() public {
        uint16 creatorFeeBps = 100; // 1%
        uint256 expectedCreatorFee = (INITIAL_B20_DEPOSIT * creatorFeeBps) / 10_000;
        uint256 expectedNetB20 = INITIAL_B20_DEPOSIT - expectedCreatorFee;

        IBulldotFactory.InstantPoolParams memory params = IBulldotFactory.InstantPoolParams({
            name: "BULL MOON",
            symbol: "BULL",
            b20Stock: address(bCOIN),
            b20Amount: INITIAL_B20_DEPOSIT,
            feeRecipient: feeRecipient,
            creatorFeeBps: creatorFeeBps
        });

        vm.prank(creator);
        (address tokenAddr, PoolId poolId) = factory.createInstantPool(params);

        assertTrue(tokenAddr != address(0), "Token address should be valid");
        assertTrue(PoolId.unwrap(poolId) != bytes32(0), "PoolId should be non-zero");

        assertEq(bCOIN.balanceOf(feeRecipient), expectedCreatorFee, "Creator fee should be delivered");

        address deadAddress = address(0x000000000000000000000000000000000000dEaD);
        assertEq(bCOIN.balanceOf(deadAddress), expectedNetB20, "Net B20 must be locked in Dead address");
        assertEq(BulldotToken(tokenAddr).balanceOf(deadAddress), 1_000_000_000 * 1e18, "100% token supply locked in Dead address");

        assertEq(bCOIN.balanceOf(address(factory)), 0, "Factory should hold zero B20");
        assertEq(BulldotToken(tokenAddr).balanceOf(address(factory)), 0, "Factory should hold zero tokens");

        assertEq(factory.totalLaunchedTokens(), 1);
    }

    function test_BondingCurveLaunchAndAutomatedMigration() public {
        uint16 creatorFeeBps = 150; // 1.5%

        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Curve Token Alpha",
            symbol: "CTA",
            b20Stock: address(bCOIN),
            feeRecipient: feeRecipient,
            creatorFeeBps: creatorFeeBps,
            maxWalletBps: 0
        });

        vm.prank(creator);
        (address tokenAddr, address curveAddr) = factory.createBondingCurve(params);

        assertTrue(tokenAddr != address(0));
        assertTrue(curveAddr != address(0));
        assertTrue(factory.isDeployedCurve(curveAddr));
        assertEq(BulldotToken(tokenAddr).balanceOf(curveAddr), 1_000_000_000 * 1e18);

        BulldotBondingCurve curve = BulldotBondingCurve(curveAddr);

        uint256 buyAmount = 10 * 1e18; // 10 bCOIN
        vm.prank(buyer);
        bCOIN.approve(curveAddr, type(uint256).max);

        vm.prank(buyer);
        uint256 tokensReceived = curve.buy(buyAmount, 0, buyer);

        assertTrue(tokensReceived > 0, "Buyer should receive tokens");
        uint256 expectedCreatorFee = (buyAmount * creatorFeeBps) / 10_000;
        assertEq(feeVault.pendingRawBalance(tokenAddr, address(bCOIN)), expectedCreatorFee, "Creator fee buffered in feeVault for claim");

        uint256 remainingB20Needed = 60 * 1e18;
        vm.prank(buyer);
        curve.buy(remainingB20Needed, 0, buyer);

        assertTrue(curve.isGraduated(), "Curve must be automatically graduated");

        address dead = address(0x000000000000000000000000000000000000dEaD);
        assertTrue(bCOIN.balanceOf(dead) > 0, "B20 reserves must be locked in Dead address");
        assertTrue(BulldotToken(tokenAddr).balanceOf(dead) > 0, "Token reserves must be locked in Dead address");

        assertEq(bCOIN.balanceOf(curveAddr), 0, "Curve B20 balance must be zero");
        assertEq(BulldotToken(tokenAddr).balanceOf(curveAddr), 0, "Curve token balance must be zero");
    }

    function test_B20MultiplierStockSplitSimulation() public {
        assertEq(bCOIN.multiplier(), 1e18);
        assertEq(bCOIN.tokensToShares(10 * 1e18), 10 * 1e18);

        bCOIN.simulateStockSplit(4e18);

        assertEq(bCOIN.multiplier(), 4e18);
        assertEq(bCOIN.tokensToShares(40 * 1e18), 10 * 1e18);
        assertEq(bCOIN.sharesToTokens(10 * 1e18), 40 * 1e18);
    }

    function test_LockedDownAdminControls() public {
        vm.prank(creator);
        vm.expectRevert(BulldotFactory.Unauthorized.selector);
        factory.setB20StockVerification(address(unverifiedStock), true);

        vm.prank(owner);
        factory.setB20StockVerification(address(unverifiedStock), true);
        assertTrue(factory.isVerifiedB20Stock(address(unverifiedStock)));

        vm.prank(owner);
        factory.renounceOwnership();
        assertEq(factory.owner(), address(0));

        vm.prank(owner);
        vm.expectRevert(BulldotFactory.Unauthorized.selector);
        factory.setB20StockVerification(address(unverifiedStock), false);
    }

    function test_OfficialTokenBadgeVerification() public {
        IBulldotFactory.InstantPoolParams memory params = IBulldotFactory.InstantPoolParams({
            name: "Verified Token",
            symbol: "VER",
            b20Stock: address(bCOIN),
            b20Amount: INITIAL_B20_DEPOSIT,
            feeRecipient: feeRecipient,
            creatorFeeBps: 100
        });

        vm.prank(creator);
        (address tokenAddr, ) = factory.createInstantPool(params);

        assertTrue(factory.isOfficialLaunch(tokenAddr), "Launched token must have official verification badge");
        assertFalse(factory.isOfficialLaunch(address(0xDEADBEEF)), "Random token must not have verification badge");
    }

    function test_RevertWhenMaxWalletExceeds100Percent() public {
        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Invalid Cap Token",
            symbol: "ICT",
            b20Stock: address(bCOIN),
            feeRecipient: feeRecipient,
            creatorFeeBps: 100,
            maxWalletBps: 10_001 // > 100%
        });

        vm.prank(creator);
        vm.expectRevert(BulldotFactory.InvalidMaxWallet.selector);
        factory.createBondingCurve(params);
    }

    function test_TokenToCurveMapping() public {
        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Mapped Token",
            symbol: "MAP",
            b20Stock: address(bCOIN),
            feeRecipient: feeRecipient,
            creatorFeeBps: 100,
            maxWalletBps: 200
        });

        vm.prank(creator);
        (address tokenAddr, address curveAddr) = factory.createBondingCurve(params);

        assertEq(factory.tokenToCurve(tokenAddr), curveAddr, "Factory must accurately map token to curve");
        assertEq(factory.allTokensCount(), 1, "Factory must accurately track launched tokens count");
    }
}
