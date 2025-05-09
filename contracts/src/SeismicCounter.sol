// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract SeismicCounter {
    suint256 number;

    function setNumber(suint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }

    function isOdd() public view returns (bool) {
        return number % suint256(2) == suint256(1);
    }

    // exposed for testing purposes
    function getNumber() public view returns (uint256) {
        return uint256(number);
    }
}
