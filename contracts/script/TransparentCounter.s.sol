// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {TransparentCounter} from "../src/TransparentCounter.sol";

contract TransparentCounterScript is Script {
    TransparentCounter public counter;

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        counter = new TransparentCounter();

        vm.stopBroadcast();
    }
}
