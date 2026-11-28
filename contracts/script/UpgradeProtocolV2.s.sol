// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {BulldotCurveDeployer} from "../src/BulldotCurveDeployer.sol";
import {BulldotFeeVault} from "../src/BulldotFeeVault.sol";
import {BulldotRouter} from "../src/BulldotRouter.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";

/**
 * @notice Deploys upgraded v2 core contracts (with working PoolManager LP lock + accurate v4 reserves quote)
 *         while reusing existing verified Base Sepolia B20 stocks & B20 Registry, and seeds 0.05% ETH/Stock
 *         pools at realistic USD market ratios within a <0.0012 ETH testnet budget.
 */
contract UpgradeProtocolV2Script is Script {
    using stdJson for string;

    function run() external {
        uint256 chainId = block.chainid;
        require(chainId == 84532, "BASE_SEPOLIA_ONLY");

        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/config/", vm.toString(chainId), ".json");
        string memory json = vm.readFile(path);

        address poolManager = json.readAddress(".uniswapV4.poolManager");
        address positionManager = json.readAddress(".uniswapV4.positionManager");
        address b20Registry = json.readAddress(".b20Registry");
        address treasury = json.readAddress(".protocolFeeRecipient");

        address bCOIN = json.readAddress(".verifiedB20Stocks[0].address");
        address bNVDA = json.readAddress(".verifiedB20Stocks[1].address");
        address bAAPL = json.readAddress(".verifiedB20Stocks[2].address");
        address bTSLA = json.readAddress(".verifiedB20Stocks[3].address");

        address[] memory initialStocks = new address[](4);
        initialStocks[0] = bCOIN;
        initialStocks[1] = bNVDA;
        initialStocks[2] = bAAPL;
        initialStocks[3] = bTSLA;

        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        BulldotFeeVault feeVault = new BulldotFeeVault();
        BulldotCurveDeployer curveDeployer = new BulldotCurveDeployer();
        BulldotFactory factory = new BulldotFactory(
            poolManager,
            positionManager,
            treasury,
            address(feeVault),
            b20Registry,
            address(curveDeployer),
            initialStocks
        );
        feeVault.setFactory(address(factory));

        BulldotRouter router = new BulldotRouter(address(factory), poolManager);
        address broadcaster = router.owner();

        // Use fresh 0.05% tier (fee = 500, tickSpacing = 10) for USD-realistic ETH <-> Stock pools
        // Assumes ~$3,000/ETH against reference stock prices ($260, $140, $230, $330)
        uint256[4] memory stockAmounts = [
            uint256(2884615384615384), // 0.00288 bCOIN (~$0.75)
            uint256(5357142857142857), // 0.00535 bNVDA (~$0.75)
            uint256(3260869565217391), // 0.00326 bAAPL (~$0.75)
            uint256(2272727272727272)  // 0.00227 bTSLA (~$0.75)
        ];
        uint256 ethPerPool = 0.00025 ether; // Total 0.0010 ETH across 4 pools (~$0.75/pool)

        for (uint256 i = 0; i < initialStocks.length; i++) {
            address stock = initialStocks[i];
            uint256 amt = stockAmounts[i];
            router.setEthPoolConfig(stock, 500, 10);
            MockB20Stock(stock).mint(broadcaster, amt);
            MockB20Stock(stock).approve(address(router), amt);
            router.seedEthStockPool{value: ethPerPool}(stock, amt);
        }

        vm.stopBroadcast();

        console2.log("=== UPGRADE V2 SUMMARY ===");
        console2.log("Factory:", address(factory));
        console2.log("CurveDeployer:", address(curveDeployer));
        console2.log("FeeVault:", address(feeVault));
        console2.log("Router:", address(router));
        console2.log("PoolManager:", poolManager);
    }
}
