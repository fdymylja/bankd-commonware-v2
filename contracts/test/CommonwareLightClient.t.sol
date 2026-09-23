// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { ILightClientMsgs } from "@ibc/contracts/msgs/ILightClientMsgs.sol";
import { IICS02ClientMsgs } from "@ibc/contracts/msgs/IICS02ClientMsgs.sol";
import { TrieProof } from "@ibc/contracts/utils/TrieProof.sol";
import { LibBLS12381 as BLS } from "@commonware/certificate/LibBLS12381.sol";

import { CommonwareLightClient } from "../src/light-client/CommonwareLightClient.sol";
import { G2Lib } from "../src/light-client/G2Lib.sol";
import { TempoHeaderLib } from "../src/light-client/TempoHeaderLib.sol";

/// @dev Exposes library internals so tests can hit them directly.
contract LibHarness {
    function compress(BLS.G2Point memory k) external pure returns (bytes memory) {
        return G2Lib.compress(k);
    }

    function readDkgOutcome(bytes memory d) external pure returns (uint64, bytes memory) {
        return TempoHeaderLib.readDkgOutcome(d);
    }

    function decode(bytes memory h) external pure returns (TempoHeaderLib.Header memory) {
        return TempoHeaderLib.decode(h);
    }
}

/// @dev Fixture from relayer/scripts/gen-lc-fixture.sh: real tempo types signed with a commonware
/// threshold key (vectorgen) and eth_getProof output from anvil.
contract CommonwareLightClientTest is Test {
    string internal json;
    CommonwareLightClient internal lc;
    LibHarness internal lib;
    uint64 internal epochLength;
    address internal router;

    function setUp() public {
        json = vm.readFile(string.concat(vm.projectRoot(), "/test/fixtures/lc.json"));
        epochLength = uint64(vm.parseJsonUint(json, ".epochLength"));
        router = vm.parseJsonAddress(json, ".router");
        lc =
            new CommonwareLightClient(router, vm.parseJsonBytes(json, ".namespace"), epochLength, 0, _key(".epoch0Key"));
        lib = new LibHarness();
    }

    // ---------- helpers ----------

    function _key(string memory path) internal view returns (BLS.G2Point memory) {
        return abi.decode(vm.parseJsonBytes(json, path), (BLS.G2Point));
    }

    function _u(uint256 i, string memory field) internal pure returns (string memory) {
        return string.concat(".updates[", vm.toString(i), "].", field);
    }

    function _msg(uint256 i) internal view returns (CommonwareLightClient.MsgUpdateClient memory m) {
        m.headerRlp = vm.parseJsonBytes(json, _u(i, "headerRlp"));
        m.viewNumber = uint64(vm.parseJsonUint(json, _u(i, "view")));
        m.parentView = uint64(vm.parseJsonUint(json, _u(i, "parentView")));
        m.signature = vm.parseJsonBytes(json, _u(i, "voteSignature"));
    }

    function _update(CommonwareLightClient.MsgUpdateClient memory m) internal returns (ILightClientMsgs.UpdateResult) {
        return lc.updateClient(abi.encode(m));
    }

    function _height(uint256 i) internal view returns (uint64) {
        return uint64(vm.parseJsonUint(json, _u(i, "height")));
    }

    function _proof(string memory storageKey) internal view returns (bytes memory) {
        return abi.encode(
            CommonwareLightClient.MembershipProof({
                accountProof: vm.parseJsonBytesArray(json, ".accountProof"),
                storageProof: vm.parseJsonBytesArray(json, storageKey)
            })
        );
    }

    function _membership(uint64 height) internal view returns (ILightClientMsgs.MsgVerifyMembership memory m) {
        m.proof = _proof(".storageProof");
        m.proofHeight = IICS02ClientMsgs.Height(0, height);
        m.path = new bytes[](1);
        m.path[0] = vm.parseJsonBytes(json, ".commitmentPath");
        m.value = vm.parseJsonBytes(json, ".commitment");
    }

    // ---------- header + codec ----------

    function test_DecodeHeader() public view {
        TempoHeaderLib.Header memory h = lib.decode(vm.parseJsonBytes(json, _u(0, "headerRlp")));
        assertEq(h.number, _height(0));
        assertEq(h.stateRoot, vm.parseJsonBytes32(json, _u(0, "stateRoot")));
        assertEq(h.timestamp, vm.parseJsonUint(json, _u(0, "timestamp")));
        assertTrue(h.hasContext);
        assertEq(h.ctxView, vm.parseJsonUint(json, _u(0, "view")));
        assertEq(keccak256(vm.parseJsonBytes(json, _u(0, "headerRlp"))), vm.parseJsonBytes32(json, _u(0, "headerHash")));
    }

    function test_CompressMatchesBlst() public view {
        assertEq(lib.compress(_key(".epoch0Key")), vm.parseJsonBytes(json, ".epoch0KeyCompressed"));
        assertEq(lib.compress(_key(".epoch1Key")), vm.parseJsonBytes(json, ".epoch1KeyCompressed"));
    }

    function test_ReadDkgOutcome() public view {
        (uint64 epoch, bytes memory id) = lib.readDkgOutcome(vm.parseJsonBytes(json, ".dkgOutcome"));
        assertEq(epoch, 1);
        assertEq(id, vm.parseJsonBytes(json, ".epoch1KeyCompressed"));
    }

    // ---------- updateClient ----------

    function test_UpdateClient() public {
        bytes memory raw = abi.encode(_msg(0));
        uint256 gasBefore = gasleft();
        ILightClientMsgs.UpdateResult res = lc.updateClient(raw);
        emit log_named_uint("updateClient gas (non-boundary)", gasBefore - gasleft());
        assertEq(uint8(res), uint8(ILightClientMsgs.UpdateResult.Update));

        CommonwareLightClient.ConsensusState memory cs = lc.getConsensusState(_height(0));
        assertEq(cs.stateRoot, vm.parseJsonBytes32(json, _u(0, "stateRoot")));
        assertEq(cs.timestamp, vm.parseJsonUint(json, _u(0, "timestamp")));

        // Same header again is a no-op.
        assertEq(uint8(_update(_msg(0))), uint8(ILightClientMsgs.UpdateResult.NoOp));
    }

    function test_RevertWhen_TamperedHeader() public {
        CommonwareLightClient.MsgUpdateClient memory m = _msg(0);
        // Byte 20 sits inside parent_hash, so the RLP stays valid and only the block hash changes.
        m.headerRlp[20] ^= 0x01;
        vm.expectRevert(CommonwareLightClient.InvalidCertificate.selector);
        _update(m);
    }

    function test_RevertWhen_WrongView() public {
        CommonwareLightClient.MsgUpdateClient memory m = _msg(0);
        m.viewNumber += 1;
        // consensus_context in the header pins the view, so this fails before the pairing.
        vm.expectRevert(CommonwareLightClient.ContextMismatch.selector);
        _update(m);
    }

    function test_RevertWhen_BadSignature() public {
        CommonwareLightClient.MsgUpdateClient memory m = _msg(0);
        // Epoch 1's certificate is a valid G1 point but signed by the other committee.
        m.signature = vm.parseJsonBytes(json, _u(2, "voteSignature"));
        vm.expectRevert(CommonwareLightClient.InvalidCertificate.selector);
        _update(m);
    }

    function test_RevertWhen_UnknownEpoch() public {
        vm.expectRevert(abi.encodeWithSelector(CommonwareLightClient.UnknownEpoch.selector, uint64(1)));
        _update(_msg(2));
    }

    function test_EpochRotation() public {
        CommonwareLightClient.MsgUpdateClient memory boundary = _msg(1);
        boundary.nextGroupKey = _key(".epoch1Key");
        bytes memory raw = abi.encode(boundary);
        uint256 gasBefore = gasleft();
        lc.updateClient(raw);
        emit log_named_uint("updateClient gas (boundary + rotation)", gasBefore - gasleft());

        assertEq(keccak256(abi.encode(lc.getGroupKey(1))), keccak256(abi.encode(_key(".epoch1Key"))));

        // Epoch 1 header verifies under the rotated key.
        assertEq(uint8(_update(_msg(2))), uint8(ILightClientMsgs.UpdateResult.Update));

        // Epoch 0 is now stale.
        vm.expectRevert(abi.encodeWithSelector(CommonwareLightClient.StaleEpoch.selector, uint64(0), uint64(1)));
        _update(_msg(0));
    }

    function test_RevertWhen_BoundaryKeyMismatch() public {
        CommonwareLightClient.MsgUpdateClient memory boundary = _msg(1);
        boundary.nextGroupKey = _key(".epoch0Key"); // valid point, wrong key
        vm.expectRevert(CommonwareLightClient.GroupKeyMismatch.selector);
        _update(boundary);
    }

    function test_RevertWhen_BoundaryKeyOffCurve() public {
        CommonwareLightClient.MsgUpdateClient memory boundary = _msg(1);
        boundary.nextGroupKey = _key(".epoch1Key");
        boundary.nextGroupKey.yC0Lo = bytes32(uint256(boundary.nextGroupKey.yC0Lo) ^ 1);
        vm.expectRevert(CommonwareLightClient.InvalidGroupKey.selector);
        _update(boundary);
    }

    // ---------- membership ----------

    function test_VerifyMembership() public {
        _update(_msg(0));
        ILightClientMsgs.MsgVerifyMembership memory m = _membership(_height(0));
        uint256 gasBefore = gasleft();
        uint256 ts = lc.verifyMembership(m);
        emit log_named_uint("verifyMembership gas", gasBefore - gasleft());
        assertEq(ts, vm.parseJsonUint(json, _u(0, "timestamp")));
    }

    function test_RevertWhen_MembershipWrongValue() public {
        _update(_msg(0));
        ILightClientMsgs.MsgVerifyMembership memory m = _membership(_height(0));
        m.value = abi.encodePacked(bytes32(uint256(1)));
        vm.expectRevert();
        lc.verifyMembership(m);
    }

    function test_RevertWhen_MembershipUnknownHeight() public {
        vm.expectRevert(abi.encodeWithSelector(CommonwareLightClient.ConsensusStateNotFound.selector, _height(0)));
        lc.verifyMembership(_membership(_height(0)));
    }

    function test_RevertWhen_MembershipWrongPath() public {
        _update(_msg(0));
        ILightClientMsgs.MsgVerifyMembership memory m = _membership(_height(0));
        m.path[0] = vm.parseJsonBytes(json, ".absentPath");
        vm.expectRevert();
        lc.verifyMembership(m);
    }

    function test_VerifyNonMembership() public {
        _update(_msg(0));
        ILightClientMsgs.MsgVerifyNonMembership memory m;
        m.proof = _proof(".absentStorageProof");
        m.proofHeight = IICS02ClientMsgs.Height(0, _height(0));
        m.path = new bytes[](1);
        m.path[0] = vm.parseJsonBytes(json, ".absentPath");
        assertEq(lc.verifyNonMembership(m), vm.parseJsonUint(json, _u(0, "timestamp")));

        // The present key can't be proven absent.
        m.proof = _proof(".storageProof");
        m.path[0] = vm.parseJsonBytes(json, ".commitmentPath");
        vm.expectRevert(CommonwareLightClient.InvalidExclusionProof.selector);
        lc.verifyNonMembership(m);
    }
}
