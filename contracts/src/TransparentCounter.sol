// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract TransparentCounter {
    uint256 public number;

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }

    function isOdd() public view returns (bool) {
        return number % 2 == 1;
    }
}
