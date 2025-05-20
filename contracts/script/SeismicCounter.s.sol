// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {SeismicCounter} from "../src/SeismicCounter.sol";

contract SeismicCounterScript is Script {
    SeismicCounter public counter;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        counter = new SeismicCounter();

        vm.stopBroadcast();
    }
}
