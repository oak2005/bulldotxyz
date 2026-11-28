// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {BulldotRouter} from "../src/BulldotRouter.sol";
import {BulldotCurveDeployer} from "../src/BulldotCurveDeployer.sol";
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
        BulldotCurveDeployer curveDeployer = new BulldotCurveDeployer();

        address[] memory initialStocks = new address[](1);
        initialStocks[0] = address(bCOIN);

        factory = new BulldotFactory(
            BASE_SEPOLIA_POOL_MANAGER,
            address(0),
            owner,
            address(feeVault),
            address(0),
            address(curveDeployer),
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
        assertEq(bCOIN.balanceOf(address(factory)), 0, "Factory must retain zero B20");
        assertEq(BulldotToken(tokenAddr).balanceOf(address(factory)), 0, "Factory must retain zero tokens");

        address dead = address(0x000000000000000000000000000000000000dEaD);
        // Active reserves sit inside Base Sepolia PoolManager while rounding dust goes to 0x...dEaD
        assertTrue(bCOIN.balanceOf(BASE_SEPOLIA_POOL_MANAGER) > expectedNetB20 * 99 / 100);
        assertTrue(BulldotToken(tokenAddr).balanceOf(BASE_SEPOLIA_POOL_MANAGER) > 990_000_000 * 1e18);
        assertEq(bCOIN.balanceOf(BASE_SEPOLIA_POOL_MANAGER) + bCOIN.balanceOf(dead), expectedNetB20);
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
            creatorFeeBps: creatorFeeBps,
            maxWalletBps: 0
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
        assertEq(bCOIN.balanceOf(curveAddr), 0, "Curve must retain zero B20 post-graduation");
        assertEq(BulldotToken(tokenAddr).balanceOf(curveAddr), 0, "Curve must retain zero tokens post-graduation");
        assertTrue(bCOIN.balanceOf(BASE_SEPOLIA_POOL_MANAGER) > 45 * 1e18, "Migrated B20 locked in v4 PoolManager");
        assertTrue(BulldotToken(tokenAddr).balanceOf(BASE_SEPOLIA_POOL_MANAGER) > 195_000_000 * 1e18, "Migrated tokens locked in v4 PoolManager");
    }

    function test_ForkBaseSepolia_InstantPoolEthToTokenSwapAndSell() public {
        if (block.chainid != 84532) {
            console2.log("Not on Base Sepolia fork, skipping instant v4 ETH routing test.");
            return;
        }

        vm.startPrank(owner);
        BulldotRouter router = new BulldotRouter(address(factory), BASE_SEPOLIA_POOL_MANAGER);
        router.setEthPoolConfig(address(bCOIN), 500, 10);
        vm.stopPrank();

        // 1. Seed ETH/bCOIN at realistic parity (1 ETH = ~12 bCOIN) on real Base Sepolia PoolManager
        vm.deal(creator, 1 ether);
        vm.startPrank(creator);
        bCOIN.approve(address(router), type(uint256).max);
        router.seedEthStockPool{value: 0.01 ether}(address(bCOIN), 0.12e18);

        // 2. Launch Instant Uniswap v4 Pool
        (address tokenAddr, ) = factory.createInstantPool(
            IBulldotFactory.InstantPoolParams({
                name: "BaseMeme",
                symbol: "BASEMEME",
                b20Stock: address(bCOIN),
                b20Amount: 5 * 1e18,
                feeRecipient: feeRecipient,
                creatorFeeBps: 100
            })
        );
        vm.stopPrank();

        // 3. Quote and buy via 2-hop ETH -> bCOIN -> BASEMEME on real Uniswap v4
        (uint256 quotedTokens, uint256 estStock, , ) = router.getQuoteEthToTokens(
            tokenAddr,
            address(bCOIN),
            0.0002 ether
        );
        assertTrue(quotedTokens > 100_000 * 1e18 && estStock > 0, "Quote must reflect real token output");

        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        uint256 tokensBought = router.swapEthForTokens{value: 0.0002 ether}(
            tokenAddr,
            address(bCOIN),
            (quotedTokens * 99) / 100,
            buyer,
            block.timestamp + 300
        );
        assertApproxEqRel(tokensBought, quotedTokens, 0.01e18, "Real v4 swap must match quote within 1%");

        // 4. Sell half back via 2-hop BASEMEME -> bCOIN -> ETH on real Uniswap v4
        uint256 sellAmt = tokensBought / 2;
        (uint256 quotedEth, , , ) = router.getQuoteTokensToEth(tokenAddr, address(bCOIN), sellAmt);
        assertTrue(quotedEth > 0);

        vm.startPrank(buyer);
        BulldotToken(tokenAddr).approve(address(router), sellAmt);
        uint256 ethBefore = buyer.balance;
        uint256 ethOut = router.swapTokensForEth(
            tokenAddr,
            address(bCOIN),
            sellAmt,
            (quotedEth * 99) / 100,
            buyer,
            block.timestamp + 300
        );
        vm.stopPrank();

        assertApproxEqRel(ethOut, quotedEth, 0.01e18, "Real v4 sell must return ETH within 1% of quote");
        assertEq(buyer.balance, ethBefore + ethOut);
    }

    function test_ForkBaseSepolia_RealV4EthToStockToMemeAndSellToEth() public {
        if (block.chainid != 84532) {
            console2.log("Not on Base Sepolia fork, skipping real v4 ETH routing test.");
            return;
        }

        BulldotRouter router = new BulldotRouter(address(factory), BASE_SEPOLIA_POOL_MANAGER);

        // 1. Seed real Uniswap v4 ETH/bCOIN pool on Base Sepolia PoolManager
        vm.deal(creator, 1 ether);
        vm.startPrank(creator);
        bCOIN.approve(address(router), type(uint256).max);
        uint128 liqAdded = router.seedEthStockPool{value: 0.0004 ether}(address(bCOIN), 2 * 1e18);
        assertTrue(liqAdded > 0, "Real Uniswap v4 liquidity must be added");

        // 2. Launch Bonding Curve paired with bCOIN
        (address tokenAddr, ) = factory.createBondingCurve(
            IBulldotFactory.BondingCurveParams({
                name: "ETH Route Token",
                symbol: "ERT",
                b20Stock: address(bCOIN),
                feeRecipient: feeRecipient,
                creatorFeeBps: 100,
                maxWalletBps: 200
            })
        );
        vm.stopPrank();

        // 3. Read live on-chain 2-hop quote for 0.0001 ETH -> bCOIN -> ERT
        (uint256 quotedTokens, uint256 estStock, , ) = router.getQuoteEthToTokens(
            tokenAddr,
            address(bCOIN),
            0.0001 ether
        );
        assertTrue(quotedTokens > 0 && estStock > 0, "Live v4 2-hop buy quote must be positive");

        // 4. Execute real atomic ETH -> bCOIN -> ERT buy via Uniswap v4 + BondingCurve
        vm.deal(buyer, 1 ether);
        uint256 buyerEthBefore = buyer.balance;
        vm.prank(buyer);
        uint256 tokensBought = router.swapEthForTokens{value: 0.0001 ether}(
            tokenAddr,
            address(bCOIN),
            (quotedTokens * 95) / 100,
            buyer,
            block.timestamp + 300
        );
        assertTrue(tokensBought > 0);
        assertEq(BulldotToken(tokenAddr).balanceOf(buyer), tokensBought);
        assertEq(buyerEthBefore - buyer.balance, 0.0001 ether);

        // 5. Execute real atomic ERT -> bCOIN -> ETH sell back to buyer's ETH wallet
        uint256 sellAmount = tokensBought / 2;
        (uint256 quotedEthOut, , , ) = router.getQuoteTokensToEth(tokenAddr, address(bCOIN), sellAmount);
        assertTrue(quotedEthOut > 0, "Live v4 2-hop sell quote must be positive");

        vm.startPrank(buyer);
        BulldotToken(tokenAddr).approve(address(router), sellAmount);
        uint256 ethBeforeSell = buyer.balance;
        uint256 ethReceived = router.swapTokensForEth(
            tokenAddr,
            address(bCOIN),
            sellAmount,
            (quotedEthOut * 95) / 100,
            buyer,
            block.timestamp + 300
        );
        vm.stopPrank();

        assertTrue(ethReceived > 0, "Seller must receive real Native ETH");
        assertEq(buyer.balance, ethBeforeSell + ethReceived);
        assertEq(address(router).balance, 0, "Router must hold zero leftover ETH");
        assertEq(bCOIN.balanceOf(address(router)), 0, "Router must hold zero leftover B20");
    }
}
