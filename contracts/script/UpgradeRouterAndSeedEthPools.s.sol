// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {BulldotRouter} from "../src/BulldotRouter.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";

/**
 * @notice Deploys updated BulldotRouter (with 2-hop Uniswap v4 ETH <-> B20 <-> Meme support)
 *         pointing to the existing BulldotFactory, and seeds ETH/Stock Uniswap v4 pools on testnet.
 */
contract UpgradeRouterAndSeedEthPoolsScript is Script {
    using stdJson for string;

    function run() external {
        uint256 chainId = block.chainid;
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/config/", vm.toString(chainId), ".json");
        string memory json = vm.readFile(path);

        address poolManager = json.readAddress(".uniswapV4.poolManager");
        address factoryAddr = json.readAddress(".factory");
        address bCOIN = json.readAddress(".verifiedB20Stocks[0].address");
        address bNVDA = json.readAddress(".verifiedB20Stocks[1].address");
        address bAAPL = json.readAddress(".verifiedB20Stocks[2].address");
        address bTSLA = json.readAddress(".verifiedB20Stocks[3].address");

        require(factoryAddr != address(0), "FACTORY_NOT_CONFIGURED");

        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        BulldotRouter router = new BulldotRouter(factoryAddr, poolManager);
        address broadcaster = router.owner();
        console2.log("Upgraded BulldotRouter deployed at:", address(router));
        console2.log("Broadcaster:", broadcaster);

        if (chainId == 84532) {
            address[4] memory stocks = [bCOIN, bNVDA, bAAPL, bTSLA];
            uint256 ethPerPool = 0.0004 ether; // Total 0.0016 ETH across 4 pools (1 ETH = 5,000 test shares)
            uint256 stockPerPool = 2 * 1e18;

            for (uint256 i = 0; i < stocks.length; i++) {
                address stock = stocks[i];
                MockB20Stock(stock).mint(broadcaster, stockPerPool);
                MockB20Stock(stock).approve(address(router), stockPerPool);
                uint128 liq = router.seedEthStockPool{value: ethPerPool}(stock, stockPerPool);
                console2.log("Seeded Uniswap v4 ETH pool for stock:", stock);
                console2.log("Liquidity added:", uint256(liq));
            }
        }

        vm.stopBroadcast();
    }
}

