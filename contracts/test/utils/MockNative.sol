// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { Vm } from "forge-std/Vm.sol";

/// @dev Stand-in for the Native precompile. Etched at NATIVE_PRECOMPILE, it edits balances with
/// vm.deal the way the real precompile edits journal balances.
contract MockNative {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error InsufficientBalance();

    function mint(address to, uint256 value) external returns (bool) {
        VM.deal(to, to.balance + value);
        return true;
    }

    function burn(address from, uint256 value) external returns (bool) {
        require(from.balance >= value, InsufficientBalance());
        VM.deal(from, from.balance - value);
        return true;
    }
}
