// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {BulldotFactory} from "../src/BulldotFactory.sol";
import {BulldotCurveDeployer} from "../src/BulldotCurveDeployer.sol";
import {BulldotFeeVault} from "../src/BulldotFeeVault.sol";
import {BulldotRouter} from "../src/BulldotRouter.sol";
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
        address configProtocolFeeRecipient = json.readAddress(".protocolFeeRecipient");

        // Supports keystore (--account), prompt (--interactive), hardware (--ledger), or optional env var
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        address[] memory initialStocks;

        // If on Base Sepolia, deploy mock B20 stocks & registry if needed
        if (chainId == 84532) {
            initialStocks = new address[](4);
            MockB20Stock bCOIN = new MockB20Stock("Coinbase Tokenized Stock", "bCOIN");
            MockB20Stock bNVDA = new MockB20Stock("Nvidia Tokenized Stock", "bNVDA");
            MockB20Stock bAAPL = new MockB20Stock("Apple Tokenized Stock", "bAAPL");
            MockB20Stock bTSLA = new MockB20Stock("Tesla Tokenized Stock", "bTSLA");
            initialStocks[0] = address(bCOIN);
            initialStocks[1] = address(bNVDA);
            initialStocks[2] = address(bAAPL);
            initialStocks[3] = address(bTSLA);
            console2.log("Mock bCOIN deployed at:", address(bCOIN));
            console2.log("Mock bNVDA deployed at:", address(bNVDA));
            console2.log("Mock bAAPL deployed at:", address(bAAPL));
            console2.log("Mock bTSLA deployed at:", address(bTSLA));

            if (b20Registry == address(0)) {
                MockB20Registry registry = new MockB20Registry();
                registry.registerStock(address(bCOIN), "COIN", "US19260Q1076", address(0));
                registry.registerStock(address(bNVDA), "NVDA", "US67066G1040", address(0));
                registry.registerStock(address(bAAPL), "AAPL", "US0378331005", address(0));
                registry.registerStock(address(bTSLA), "TSLA", "US88160R1014", address(0));
                b20Registry = address(registry);
                console2.log("Mock B20 Registry deployed at:", b20Registry);
            }
        } else {
            initialStocks = new address[](0);
        }

        BulldotFeeVault vault;
        if (feeVault == address(0)) {
            vault = new BulldotFeeVault();
            feeVault = address(vault);
            console2.log("BulldotFeeVault deployed at:", feeVault);
        } else {
            vault = BulldotFeeVault(feeVault);
        }

        BulldotCurveDeployer curveDeployer = new BulldotCurveDeployer();
        console2.log("BulldotCurveDeployer deployed at:", address(curveDeployer));

        address protocolFeeRecipient = chainId == 84532
            ? 0xc96147c68ca8e153e70B3bC4745b8d974bDd212A
            : (configProtocolFeeRecipient != address(0)
                ? configProtocolFeeRecipient
                : (deployerPrivateKey != 0 ? vm.addr(deployerPrivateKey) : msg.sender));

        BulldotFactory factory = new BulldotFactory(
            poolManager,
            positionManager,
            protocolFeeRecipient,
            feeVault,
            b20Registry,
            address(curveDeployer),
            initialStocks
        );

        console2.log("BulldotFactory deployed successfully at:", address(factory));
        console2.log("Factory Owner:", factory.owner());

        // Connect FeeVault to Factory
        vault.setFactory(address(factory));
        console2.log("BulldotFeeVault connected to Factory");

        // Deploy Unified Router
        BulldotRouter router = new BulldotRouter(address(factory), poolManager);
        console2.log("BulldotRouter deployed successfully at:", address(router));

        console2.log("=== DEPLOYMENT SUMMARY ===");
        console2.log("Network:", chainId);
        console2.log("Factory:", address(factory));
        console2.log("CurveDeployer:", address(curveDeployer));
        console2.log("Router:", address(router));
        console2.log("FeeVault:", feeVault);
        console2.log("B20Registry:", b20Registry);
        console2.log("PoolManager:", poolManager);

        vm.stopBroadcast();
    }
}
