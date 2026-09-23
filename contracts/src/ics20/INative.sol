// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

/// @title INative
/// @notice The bankd Native precompile (mint/burn native BRL), same ABI as bankd v1's x/native.
/// @dev Only the admin or a registered bridge may call mint/burn.
interface INative {
    function mint(address to, uint256 value) external returns (bool success);
    function burn(address from, uint256 value) external returns (bool success);
}

/// @dev Fixed precompile address, kept from bankd v1 (ASCII "ERC20").
address constant NATIVE_PRECOMPILE = 0x0000000000000000000000000000004552433230;
