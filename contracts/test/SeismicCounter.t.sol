// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {SeismicCounter} from "../src/SeismicCounter.sol";

contract SeismicCounterTest is Test {
    SeismicCounter public counter;

    function setUp() public {
        counter = new SeismicCounter();
        counter.setNumber(suint256(0));
    }

    function test_Increment() public {
        counter.increment();
        assertEq(counter.getNumber(), 1);
    }

    function testFuzz_SetNumber(uint256 x) public {
        counter.setNumber(suint256(x));
        assertEq(counter.getNumber(), x);
    }
}
