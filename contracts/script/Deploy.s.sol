// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {BulldotFeeVault} from "../src/BulldotFeeVault.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";
import {MockB20Registry} from "../src/mocks/MockB20Registry.sol";

contract DeployScript is Script {
    using stdJson for string;

    function run() external {
        uint256 chainId = block.chainid;
        console2.log("Deploying to Chain ID:", chainId);

        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/config/", vm.toString(chainId), ".json");
        string memory json = vm.readFile(path);

        address poolManager = json.readAddress(".uniswapV4.poolManager");
        address positionManager = json.readAddress(".uniswapV4.positionManager");
        address b20Registry = json.readAddress(".b20Registry");
        address feeVault = json.readAddress(".feeVault");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer address:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        address[] memory initialStocks = new address[](2);

        // If on Base Sepolia, deploy mock B20 stocks & registry if needed
        if (chainId == 84532) {
            MockB20Stock bCOIN = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");
            MockB20Stock bNVDA = new MockB20Stock("Nvidia Tokenized Stock", "bNVDA");
            initialStocks[0] = address(bCOIN);
            initialStocks[1] = address(bNVDA);
            console2.log("Mock bCOIN deployed at:", address(bCOIN));
            console2.log("Mock bNVDA deployed at:", address(bNVDA));

            if (b20Registry == address(0)) {
                MockB20Registry registry = new MockB20Registry();
                registry.registerStock(address(bCOIN), "COIN", "US19260Q1076", address(0));
                registry.registerStock(address(bNVDA), "NVDA", "US67066G1040", address(0));
                b20Registry = address(registry);
                console2.log("Mock B20 Registry deployed at:", b20Registry);
            }
        }

        if (feeVault == address(0)) {
            BulldotFeeVault vault = new BulldotFeeVault();
            feeVault = address(vault);
            console2.log("BulldotFeeVault deployed at:", feeVault);
        }

        BulldotFactory factory = new BulldotFactory(
            poolManager,
            positionManager,
            deployer, // protocol fee recipient
            feeVault,
            b20Registry,
            initialStocks
        );

        console2.log("BulldotFactory deployed successfully at:", address(factory));

        vm.stopBroadcast();
    }
}
