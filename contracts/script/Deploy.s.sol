// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {MockB20Stock} from "../src/mocks/MockB20Stock.sol";

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
        uint256 protocolFeeBps = json.readUint(".protocolFeeBps");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        console2.log("Deployer address:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        address[] memory initialStocks = new address[](2);

        // If on Base Sepolia, deploy mock B20 stocks if needed or use existing
        if (chainId == 84532) {
            MockB20Stock bCOIN = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");
            MockB20Stock bNVDA = new MockB20Stock("Nvidia Tokenized Stock", "bNVDA");
            initialStocks[0] = address(bCOIN);
            initialStocks[1] = address(bNVDA);
            console2.log("Mock bCOIN deployed at:", address(bCOIN));
            console2.log("Mock bNVDA deployed at:", address(bNVDA));
        }

        BulldotFactory factory = new BulldotFactory(
            poolManager,
            positionManager,
            deployer, // protocol fee recipient
            protocolFeeBps,
            initialStocks
        );

        console2.log("BulldotFactory deployed successfully at:", address(factory));

        vm.stopBroadcast();
    }
}
