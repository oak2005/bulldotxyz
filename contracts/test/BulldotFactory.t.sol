// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {BulldotToken} from "../src/BulldotToken.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";
import {MockUniswapV4PoolManager} from "../src/mocks/MockUniswapV4PoolManager.sol";
import {IBulldotFactory} from "../src/interfaces/IBulldotFactory.sol";
import {PoolId} from "../src/interfaces/IUniswapV4Minimal.sol";

contract BulldotFactoryTest is Test {
    BulldotFactory public factory;
    MockUniswapV4PoolManager public poolManager;
    MockB20Stock public bCOIN;
    MockB20Stock public unverifiedStock;

    address public owner = address(0xAAAA);
    address public creator = address(0xBBBB);
    address public feeRecipient = address(0xCCCC);
    address public protocolFeeRecipient = address(0xDDDD);

    uint256 public constant INITIAL_B20_DEPOSIT = 10 * 1e18; // 10 bCOIN tokens

    function setUp() public {
        vm.startPrank(owner);

        // 1. Deploy Mock Uniswap v4 PoolManager
        poolManager = new MockUniswapV4PoolManager();

        // 2. Deploy Mock B20 Stock (bCOIN)
        bCOIN = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");
        unverifiedStock = new MockB20Stock("Unverified Token", "FAKE");

        // 3. Deploy Factory with bCOIN verified
        address[] memory verifiedList = new address[](1);
        verifiedList[0] = address(bCOIN);

        factory = new BulldotFactory(
            address(poolManager),
            address(0), // PositionManager optional for MVP
            protocolFeeRecipient,
            verifiedList
        );

        vm.stopPrank();

        // Fund creator with bCOIN
        bCOIN.mint(creator, 100 * 1e18);
        unverifiedStock.mint(creator, 100 * 1e18);

        vm.startPrank(creator);
        bCOIN.approve(address(factory), type(uint256).max);
        unverifiedStock.approve(address(factory), type(uint256).max);
        vm.stopPrank();
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

        // Verify creator fee paid out immediately
        assertEq(bCOIN.balanceOf(feeRecipient), expectedCreatorFee, "Creator fee should be delivered");

        // Verify liquidity permanently locked to Dead Address (0xdEaD)
        address deadAddress = address(0x000000000000000000000000000000000000dEaD);
        assertEq(bCOIN.balanceOf(deadAddress), expectedNetB20, "Net B20 must be locked in Dead address");
        assertEq(BulldotToken(tokenAddr).balanceOf(deadAddress), 1_000_000_000 * 1e18, "100% token supply locked in Dead address");

        // Verify factory balance is zero (checks-effects-interactions, no stranded funds)
        assertEq(bCOIN.balanceOf(address(factory)), 0, "Factory should hold zero B20");
        assertEq(BulldotToken(tokenAddr).balanceOf(address(factory)), 0, "Factory should hold zero tokens");

        // Verify total tokens count
        assertEq(factory.totalLaunchedTokens(), 1);
    }

    function test_B20MultiplierStockSplitSimulation() public {
        // Initial state: multiplier is 1.0x (1e18)
        assertEq(bCOIN.multiplier(), 1e18);
        assertEq(bCOIN.tokensToShares(10 * 1e18), 10 * 1e18);

        // Simulate a 4-for-1 forward stock split on Coinbase stock
        bCOIN.simulateStockSplit(4e18);

        assertEq(bCOIN.multiplier(), 4e18);
        // Under 4x split, 40 tokens represent 10 canonical shares
        assertEq(bCOIN.tokensToShares(40 * 1e18), 10 * 1e18);
        assertEq(bCOIN.sharesToTokens(10 * 1e18), 40 * 1e18);
    }

    function test_LockedDownAdminControls() public {
        // Non-owner cannot add verified stocks
        vm.prank(creator);
        vm.expectRevert(BulldotFactory.Unauthorized.selector);
        factory.setB20StockVerification(address(unverifiedStock), true);

        // Owner can add verified stock
        vm.prank(owner);
        factory.setB20StockVerification(address(unverifiedStock), true);
        assertTrue(factory.isVerifiedB20Stock(address(unverifiedStock)));

        // Owner can renounce ownership permanently
        vm.prank(owner);
        factory.renounceOwnership();
        assertEq(factory.owner(), address(0));

        // Former owner can no longer modify anything
        vm.prank(owner);
        vm.expectRevert(BulldotFactory.Unauthorized.selector);
        factory.setB20StockVerification(address(unverifiedStock), false);
    }
}

