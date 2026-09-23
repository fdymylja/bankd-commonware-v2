// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { LibBLS12381 as BLS } from "@commonware/certificate/LibBLS12381.sol";

/// @title G2Lib
/// @notice Checks an uncompressed G2 key against its compressed (zcash/blst) encoding.
/// @dev Decompressing G2 needs an Fp2 sqrt, which is costly on chain. Compressing is cheap, so the
/// relayer supplies the uncompressed key and we check it compresses to the bytes the chain committed.
library G2Lib {
    /// @dev (p - 1) / 2 for the BLS12-381 base field, split like EIP-2537 fields (hi 16 bytes, lo 32).
    uint256 private constant HALF_HI = 0x0d0088f51cbff34d258dd3db21a5d66b;
    uint256 private constant HALF_LO = 0xb23ba5c279c2895fb39869507b587b120f55ffff58a9ffffdcff7fffffffd555;
    uint256 private constant G2ADD_GAS = 2000;

    /// @notice Compressed encoding: x.c1 || x.c0 with compression and sign flags in the top bits.
    function compress(BLS.G2Point memory k) internal pure returns (bytes memory out) {
        out = abi.encodePacked(bytes16(uint128(uint256(k.xC1Hi))), k.xC1Lo, bytes16(uint128(uint256(k.xC0Hi))), k.xC0Lo);
        // y is "lexicographically largest" when c1 > (p-1)/2, or c1 == 0 and c0 > (p-1)/2.
        bool c1Zero = k.yC1Hi == 0 && k.yC1Lo == 0;
        bool largest = c1Zero ? _gtHalf(k.yC0Hi, k.yC0Lo) : _gtHalf(k.yC1Hi, k.yC1Lo);
        out[0] = out[0] | bytes1(largest ? 0xa0 : 0x80);
    }

    /// @notice True if `k` is a canonical, non-infinity point on the G2 curve.
    /// @dev EIP-2537 G2ADD rejects off-curve or non-canonical inputs. Subgroup membership is not
    /// checked here, but x plus the sign bit pin a unique on-curve point, which is the committed key.
    function isOnCurve(BLS.G2Point memory k) internal view returns (bool) {
        if (
            k.xC0Hi == 0 && k.xC0Lo == 0 && k.xC1Hi == 0 && k.xC1Lo == 0 && k.yC0Hi == 0 && k.yC0Lo == 0 && k.yC1Hi == 0
                && k.yC1Lo == 0
        ) return false;
        BLS.G2Point memory zero;
        bytes memory input = abi.encode(k, zero);
        bool ok;
        // Capped gas: a failing precompile burns everything it was given, G2ADD costs 600.
        assembly ("memory-safe") {
            ok := staticcall(G2ADD_GAS, 0x0d, add(input, 0x20), 0x200, 0x00, 0x00)
            ok := and(ok, eq(returndatasize(), 0x100))
        }
        return ok;
    }

    function _gtHalf(bytes32 hi, bytes32 lo) private pure returns (bool) {
        return uint256(hi) > HALF_HI || (uint256(hi) == HALF_HI && uint256(lo) > HALF_LO);
    }
}
