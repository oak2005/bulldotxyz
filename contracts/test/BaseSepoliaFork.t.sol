// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {BulldotBondingCurve} from "../src/BulldotBondingCurve.sol";
import {BulldotToken} from "../src/BulldotToken.sol";
import {BulldotFeeVault} from "../src/BulldotFeeVault.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";
import {IBulldotFactory} from "../src/interfaces/IBulldotFactory.sol";
import {PoolId} from "../src/interfaces/IUniswapV4Minimal.sol";

contract BaseSepoliaForkTest is Test {
    address public constant BASE_SEPOLIA_POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;

    BulldotFactory public factory;
    BulldotFeeVault public feeVault;
    MockB20Stock public bCOIN;

    address public owner = address(0xA1);
    address public creator = address(0xB1);
    address public feeRecipient = address(0xC1);
    address public buyer = address(0xD1);

    uint256 public constant INITIAL_DEPOSIT = 25 * 1e18; // 25 bCOIN tokens

    function setUp() public {
        string memory rpcUrl = vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org"));
        
        try vm.createSelectFork(rpcUrl) returns (uint256 forkId) {
            console2.log("Fork created successfully with ID:", forkId);
        } catch {
            console2.log("Network RPC unreachable; skipping fork test");
            return;
        }

        vm.startPrank(owner);

        bCOIN = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");
        feeVault = new BulldotFeeVault();

        address[] memory initialStocks = new address[](1);
        initialStocks[0] = address(bCOIN);

        factory = new BulldotFactory(
            BASE_SEPOLIA_POOL_MANAGER,
            address(0),
            owner,
            address(feeVault),
            address(0),
            initialStocks
        );

        vm.stopPrank();

        bCOIN.mint(creator, 500 * 1e18);
        bCOIN.mint(buyer, 500 * 1e18);

        vm.prank(creator);
        bCOIN.approve(address(factory), type(uint256).max);

        vm.prank(buyer);
        bCOIN.approve(address(factory), type(uint256).max);
    }

    function test_ForkBaseSepolia_PoolManagerBytecodeExists() public view {
        if (block.chainid != 84532) {
            console2.log("Not on Base Sepolia fork, skipping check.");
            return;
        }

        uint256 codeSize;
        address target = BASE_SEPOLIA_POOL_MANAGER;
        assembly {
            codeSize := extcodesize(target)
        }
        assertTrue(codeSize > 0, "Uniswap v4 PoolManager bytecode must exist on Base Sepolia");
    }

    function test_ForkBaseSepolia_InstantPoolLaunchAndPermanentLock() public {
        if (block.chainid != 84532) {
            console2.log("Not on Base Sepolia fork, skipping launch test.");
            return;
        }

        uint16 creatorFeeBps = 150; // 1.5%
        uint256 expectedCreatorFee = (INITIAL_DEPOSIT * creatorFeeBps) / 10_000;
        uint256 expectedNetB20 = INITIAL_DEPOSIT - expectedCreatorFee;

        IBulldotFactory.InstantPoolParams memory params = IBulldotFactory.InstantPoolParams({
            name: "Base Sepolia Alpha",
            symbol: "ALPHA",
            b20Stock: address(bCOIN),
            b20Amount: INITIAL_DEPOSIT,
            feeRecipient: feeRecipient,
            creatorFeeBps: creatorFeeBps
        });

        vm.prank(creator);
        (address tokenAddr, PoolId poolId) = factory.createInstantPool(params);

        assertTrue(tokenAddr != address(0), "Token must be deployed");
        assertTrue(PoolId.unwrap(poolId) != bytes32(0), "PoolId must be valid");

        assertEq(bCOIN.balanceOf(feeRecipient), expectedCreatorFee);

        address dead = address(0x000000000000000000000000000000000000dEaD);
        assertEq(bCOIN.balanceOf(dead), expectedNetB20);
        assertEq(BulldotToken(tokenAddr).balanceOf(dead), 1_000_000_000 * 1e18);
    }

    function test_ForkBaseSepolia_BondingCurveLaunchAndMigration() public {
        if (block.chainid != 84532) {
            console2.log("Not on Base Sepolia fork, skipping bonding curve test.");
            return;
        }

        uint16 creatorFeeBps = 100; // 1.0%

        IBulldotFactory.BondingCurveParams memory params = IBulldotFactory.BondingCurveParams({
            name: "Fork Curve Token",
            symbol: "FCT",
            b20Stock: address(bCOIN),
            feeRecipient: feeRecipient,
            creatorFeeBps: creatorFeeBps
        });

        vm.prank(creator);
        (address tokenAddr, address curveAddr) = factory.createBondingCurve(params);

        assertTrue(tokenAddr != address(0));
        assertTrue(curveAddr != address(0));

        BulldotBondingCurve curve = BulldotBondingCurve(curveAddr);

        vm.prank(buyer);
        bCOIN.approve(curveAddr, type(uint256).max);

        vm.prank(buyer);
        curve.buy(70 * 1e18, 0, buyer);

        assertTrue(curve.isGraduated(), "Curve must auto-graduate on live fork");

        address dead = address(0x000000000000000000000000000000000000dEaD);
        assertTrue(bCOIN.balanceOf(dead) > 0);
        assertTrue(BulldotToken(tokenAddr).balanceOf(dead) > 0);
    }
}
