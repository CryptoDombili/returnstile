// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockDojangScroll {
    mapping(address => bool) public verified;

    function setVerified(address account, bool value) external {
        verified[account] = value;
    }

    function isVerified(address user, bytes32) external view returns (bool) {
        return verified[user];
    }
}
