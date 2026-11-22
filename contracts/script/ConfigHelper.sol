// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";

contract ConfigHelper is Script {
    using stdJson for string;

    struct NetworkConfig {
        uint256 chainId;
        string networkName;
        address poolManager;
        address positionManager;
        address permit2;
        address[] verifiedStocks;
        uint256 graduationThresholdShares;
        uint256 protocolFeeBps;
        uint256 maxCreatorFeeBps;
    }

    function getNetworkConfig() public view returns (NetworkConfig memory config) {
        uint256 chainId = block.chainid;
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/config/", vm.toString(chainId), ".json");
        string memory json = vm.readFile(path);

        config.chainId = json.readUint(".chainId");
        config.networkName = json.readString(".networkName");
        config.poolManager = json.readAddress(".uniswapV4.poolManager");
        config.positionManager = json.readAddress(".uniswapV4.positionManager");
        config.permit2 = json.readAddress(".uniswapV4.permit2");
        config.graduationThresholdShares = json.readUint(".graduationThresholdShares");
        config.protocolFeeBps = json.readUint(".protocolFeeBps");
        config.maxCreatorFeeBps = json.readUint(".maxCreatorFeeBps");
    }
}

