// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { RLP } from "@openzeppelin-contracts/utils/RLP.sol";
import { Memory } from "@openzeppelin-contracts/utils/Memory.sol";

/// @title TempoHeaderLib
/// @notice Decodes the fields the light client needs from an RLP `TempoHeader` and the DKG outcome
/// a boundary header carries in `extra_data`.
/// @dev Layout mirrors crates/primitives/src/header.rs: `[general_gas_limit, shared_gas_limit,
/// timestamp_millis_part, inner_eth_header, consensus_context?]`, with the eth header as a nested list.
library TempoHeaderLib {
    using RLP for Memory.Slice;

    struct Header {
        uint64 number;
        uint64 timestamp;
        bytes32 stateRoot;
        bytes extraData;
        bool hasContext;
        uint64 ctxEpoch;
        uint64 ctxView;
        uint64 ctxParentView;
    }

    error MalformedHeader();
    error MalformedDkgOutcome();

    // Indices into the inner eth header list.
    uint256 private constant STATE_ROOT = 3;
    uint256 private constant NUMBER = 8;
    uint256 private constant TIMESTAMP = 11;
    uint256 private constant EXTRA_DATA = 12;

    /// @notice Decodes a TempoHeader. The caller hashes the same bytes to get the block hash.
    function decode(bytes memory headerRlp) internal pure returns (Header memory h) {
        Memory.Slice[] memory outer = RLP.decodeList(headerRlp);
        require(outer.length == 4 || outer.length == 5, MalformedHeader());

        Memory.Slice[] memory inner = outer[3].readList();
        require(inner.length > EXTRA_DATA, MalformedHeader());

        h.stateRoot = inner[STATE_ROOT].readBytes32();
        h.number = _u64(inner[NUMBER].readUint256());
        h.timestamp = _u64(inner[TIMESTAMP].readUint256());
        h.extraData = inner[EXTRA_DATA].readBytes();

        if (outer.length == 5) {
            Memory.Slice[] memory ctx = outer[4].readList();
            require(ctx.length == 4, MalformedHeader());
            h.hasContext = true;
            h.ctxEpoch = _u64(ctx[0].readUint256());
            h.ctxView = _u64(ctx[1].readUint256());
            h.ctxParentView = _u64(ctx[2].readUint256());
        }
    }

    /// @notice Reads the target epoch and compressed G2 network identity from an `OnchainDkgOutcome`.
    /// @dev Encoding (crates/dkg-onchain-artifacts + commonware codec):
    /// varint(epoch) | summary[32] | mode u8 | total u32 BE | varint(coeff count) | coeff0 G2[96] | ...
    /// coeff0 of the public polynomial is the group key. Everything after it is skipped, which is
    /// fine because the header (and so extra_data) is already authenticated by the certificate.
    function readDkgOutcome(bytes memory data) internal pure returns (uint64 epoch, bytes memory identity) {
        uint256 off;
        (epoch, off) = _varint(data, 0);
        off += 32 + 1 + 4;
        uint64 coeffs;
        (coeffs, off) = _varint(data, off);
        require(coeffs != 0 && data.length >= off + 96, MalformedDkgOutcome());
        identity = new bytes(96);
        for (uint256 i = 0; i < 96; ++i) {
            identity[i] = data[off + i];
        }
    }

    function _varint(bytes memory data, uint256 off) private pure returns (uint64 value, uint256 next) {
        uint256 shift;
        while (true) {
            require(off < data.length && shift < 64, MalformedDkgOutcome());
            uint8 b = uint8(data[off++]);
            value |= uint64(uint256(b & 0x7f) << shift);
            if (b & 0x80 == 0) break;
            shift += 7;
        }
        return (value, off);
    }

    function _u64(uint256 v) private pure returns (uint64) {
        require(v <= type(uint64).max, MalformedHeader());
        return uint64(v);
    }
}
