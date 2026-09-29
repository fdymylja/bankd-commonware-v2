// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { ILightClientMsgs } from "@ibc/contracts/msgs/ILightClientMsgs.sol";
import { IICS02ClientMsgs } from "@ibc/contracts/msgs/IICS02ClientMsgs.sol";
import { IICS07TendermintMsgs } from "@ibc/contracts/light-clients/sp1-ics07/msgs/IICS07TendermintMsgs.sol";

import { TendermintLightClient } from "../src/light-client/TendermintLightClient.sol";
import { ITendermintVerifier, TENDERMINT_VERIFIER } from "../src/light-client/ITendermintVerifier.sol";

/// @dev Stands in for the precompile. Returns whatever the test set. The real one is view, so no call recording here, tests use vm.expectCall.
contract MockTendermintVerifier {
    ITendermintVerifier.ConsensusState public nextCs;
    ITendermintVerifier.Height public newHeight;
    ITendermintVerifier.Height public trustedHeight;
    bool public detected;
    bool public membershipOk;
    bool public shouldRevert;

    function setUpdate(
        ITendermintVerifier.ConsensusState memory cs,
        ITendermintVerifier.Height memory nh,
        ITendermintVerifier.Height memory th
    ) external {
        nextCs = cs;
        newHeight = nh;
        trustedHeight = th;
    }

    function setMisbehaviour(bool d, ITendermintVerifier.Height memory h1, ITendermintVerifier.Height memory h2)
        external
    {
        detected = d;
        newHeight = h1;
        trustedHeight = h2;
    }

    function setMembership(bool ok) external {
        membershipOk = ok;
    }

    function setRevert(bool r) external {
        shouldRevert = r;
    }

    function verifyUpdate(
        ITendermintVerifier.Params calldata params,
        ITendermintVerifier.ConsensusState calldata trusted,
        bytes calldata header,
        uint64 nowSeconds
    )
        external
        view
        returns (
            ITendermintVerifier.ConsensusState memory,
            ITendermintVerifier.Height memory,
            ITendermintVerifier.Height memory
        )
    {
        if (shouldRevert) revert ITendermintVerifier.VerificationFailed();
        return (nextCs, newHeight, trustedHeight);
    }

    function verifyMembership(bytes32, bytes calldata, bytes[] calldata, bytes calldata) external view returns (bool) {
        if (shouldRevert) revert ITendermintVerifier.InvalidInput();
        return membershipOk;
    }

    function checkMisbehaviour(
        ITendermintVerifier.Params calldata,
        ITendermintVerifier.ConsensusState calldata,
        ITendermintVerifier.ConsensusState calldata,
        bytes calldata,
        bytes calldata,
        uint64
    ) external returns (bool, ITendermintVerifier.Height memory, ITendermintVerifier.Height memory) {
        if (shouldRevert) revert ITendermintVerifier.VerificationFailed();
        return (detected, newHeight, trustedHeight);
    }
}

contract TendermintLightClientTest is Test {
    uint64 constant REVISION = 2;
    uint64 constant H0 = 100;
    uint128 constant T0 = 1_700_000_000e9;
    uint32 constant TRUSTING = 14 days;
    uint32 constant UNBONDING = 21 days;

    MockTendermintVerifier internal mock;
    TendermintLightClient internal lc;

    function setUp() public {
        vm.warp(T0 / 1e9 + 1 hours);
        mock = new MockTendermintVerifier();
        lc = _deploy(address(mock));
    }

    // ---------- helpers ----------

    function _state() internal pure returns (IICS07TendermintMsgs.ClientState memory) {
        return IICS07TendermintMsgs.ClientState({
            chainId: "simd-2",
            trustLevel: IICS07TendermintMsgs.TrustThreshold(1, 3),
            latestHeight: IICS02ClientMsgs.Height(REVISION, H0),
            trustingPeriod: TRUSTING,
            unbondingPeriod: UNBONDING,
            isFrozen: false,
            zkAlgorithm: IICS07TendermintMsgs.SupportedZkAlgorithm.Groth16
        });
    }

    function _cs(uint128 ts, bytes32 root) internal pure returns (IICS07TendermintMsgs.ConsensusState memory) {
        return IICS07TendermintMsgs.ConsensusState(ts, root, bytes32(uint256(0xbeef)));
    }

    function _deploy(address verifier) internal returns (TendermintLightClient) {
        return new TendermintLightClient(verifier, _state(), _cs(T0, bytes32(uint256(1))));
    }

    function _h(uint64 height) internal pure returns (ITendermintVerifier.Height memory) {
        return ITendermintVerifier.Height(REVISION, height);
    }

    function _vcs(uint128 ts, bytes32 root) internal pure returns (ITendermintVerifier.ConsensusState memory) {
        return ITendermintVerifier.ConsensusState(ts, root, bytes32(uint256(0xbeef)));
    }

    function _setUpdate(uint64 newH, uint128 ts, bytes32 root, uint64 trustedH) internal {
        mock.setUpdate(_vcs(ts, root), _h(newH), _h(trustedH));
    }

    function _update(bytes memory header, uint64 trustedH) internal returns (ILightClientMsgs.UpdateResult) {
        return lc.updateClient(abi.encode(TendermintLightClient.MsgUpdateClient(header, trustedH)));
    }

    function _membershipMsg(uint64 height, bytes memory value)
        internal
        pure
        returns (ILightClientMsgs.MsgVerifyMembership memory m)
    {
        m.proof = hex"0a00";
        m.proofHeight = IICS02ClientMsgs.Height(REVISION, height);
        m.path = new bytes[](2);
        m.path[0] = "ibc";
        m.path[1] = "commitments/x";
        m.value = value;
    }

    // ---------- constructor ----------

    function test_constructor_stores_state() public view {
        IICS07TendermintMsgs.ClientState memory cs = abi.decode(lc.getClientState(), (IICS07TendermintMsgs.ClientState));
        assertEq(cs.chainId, "simd-2");
        assertEq(cs.latestHeight.revisionHeight, H0);
        assertEq(lc.getConsensusState(H0).timestamp, T0);
        assertEq(lc.getConsensusStateHash(H0), keccak256(abi.encode(_cs(T0, bytes32(uint256(1))))));
    }

    function test_constructor_rejects_bad_config() public {
        IICS07TendermintMsgs.ClientState memory s = _state();
        s.chainId = "";
        vm.expectRevert(TendermintLightClient.InvalidChainId.selector);
        new TendermintLightClient(address(mock), s, _cs(T0, 0));

        s = _state();
        s.trustLevel = IICS07TendermintMsgs.TrustThreshold(1, 4);
        vm.expectRevert(abi.encodeWithSelector(TendermintLightClient.InvalidTrustLevel.selector, 1, 4));
        new TendermintLightClient(address(mock), s, _cs(T0, 0));

        s = _state();
        s.trustLevel = IICS07TendermintMsgs.TrustThreshold(3, 2);
        vm.expectRevert(abi.encodeWithSelector(TendermintLightClient.InvalidTrustLevel.selector, 3, 2));
        new TendermintLightClient(address(mock), s, _cs(T0, 0));

        s = _state();
        s.trustLevel = IICS07TendermintMsgs.TrustThreshold(0, 0);
        vm.expectRevert(abi.encodeWithSelector(TendermintLightClient.InvalidTrustLevel.selector, 0, 0));
        new TendermintLightClient(address(mock), s, _cs(T0, 0));

        s = _state();
        s.trustingPeriod = UNBONDING;
        vm.expectRevert(
            abi.encodeWithSelector(TendermintLightClient.InvalidTrustingPeriod.selector, UNBONDING, UNBONDING)
        );
        new TendermintLightClient(address(mock), s, _cs(T0, 0));

        s = _state();
        s.isFrozen = true;
        vm.expectRevert(TendermintLightClient.InvalidInitialState.selector);
        new TendermintLightClient(address(mock), s, _cs(T0, 0));

        vm.expectRevert(TendermintLightClient.InvalidInitialState.selector);
        new TendermintLightClient(address(mock), _state(), _cs(0, 0));
    }

    // ---------- updateClient ----------

    function test_update_adds_consensus_state() public {
        _setUpdate(H0 + 5, T0 + 30e9, bytes32(uint256(2)), H0);
        assertEq(uint8(_update("hdr", H0)), uint8(ILightClientMsgs.UpdateResult.Update));

        assertEq(lc.getConsensusState(H0 + 5).root, bytes32(uint256(2)));
        IICS07TendermintMsgs.ClientState memory cs = abi.decode(lc.getClientState(), (IICS07TendermintMsgs.ClientState));
        assertEq(cs.latestHeight.revisionHeight, H0 + 5);
        assertEq(cs.latestHeight.revisionNumber, REVISION);
    }

    function test_update_passes_params_and_block_time_to_precompile() public {
        _setUpdate(H0 + 1, T0 + 5e9, bytes32(uint256(2)), H0);
        ITendermintVerifier.Params memory p =
            ITendermintVerifier.Params("simd-2", 1, 3, TRUSTING, UNBONDING, lc.MAX_CLOCK_DRIFT());
        vm.expectCall(
            address(mock),
            abi.encodeCall(
                ITendermintVerifier.verifyUpdate,
                (p, _vcs(T0, bytes32(uint256(1))), bytes("some-header"), uint64(block.timestamp))
            )
        );
        _update("some-header", H0);
    }

    function test_update_backfill_keeps_latest_height() public {
        _setUpdate(H0 + 10, T0 + 60e9, bytes32(uint256(2)), H0);
        _update("a", H0);
        _setUpdate(H0 + 5, T0 + 30e9, bytes32(uint256(3)), H0);
        _update("b", H0);

        IICS07TendermintMsgs.ClientState memory cs = abi.decode(lc.getClientState(), (IICS07TendermintMsgs.ClientState));
        assertEq(cs.latestHeight.revisionHeight, H0 + 10);
        assertEq(lc.getConsensusState(H0 + 5).root, bytes32(uint256(3)));
    }

    function test_update_same_state_is_noop() public {
        _setUpdate(H0 + 5, T0 + 30e9, bytes32(uint256(2)), H0);
        _update("a", H0);
        assertEq(uint8(_update("a", H0)), uint8(ILightClientMsgs.UpdateResult.NoOp));
    }

    function test_update_conflicting_state_freezes() public {
        _setUpdate(H0 + 5, T0 + 30e9, bytes32(uint256(2)), H0);
        _update("a", H0);

        _setUpdate(H0 + 5, T0 + 30e9, bytes32(uint256(99)), H0);
        assertEq(uint8(_update("b", H0)), uint8(ILightClientMsgs.UpdateResult.Misbehaviour));

        IICS07TendermintMsgs.ClientState memory cs = abi.decode(lc.getClientState(), (IICS07TendermintMsgs.ClientState));
        assertTrue(cs.isFrozen);

        vm.expectRevert(TendermintLightClient.FrozenClientState.selector);
        _update("c", H0);
        vm.expectRevert(TendermintLightClient.FrozenClientState.selector);
        lc.verifyMembership(_membershipMsg(H0, hex"01"));
    }

    function test_update_non_increasing_time_at_known_height_freezes() public {
        // Same state as stored at H0 but trusted state's time is not before it.
        mock.setUpdate(_vcs(T0, bytes32(uint256(1))), _h(H0), _h(H0));
        assertEq(uint8(_update("a", H0)), uint8(ILightClientMsgs.UpdateResult.Misbehaviour));
    }

    function test_update_unknown_trusted_height_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(TendermintLightClient.ConsensusStateNotFound.selector, H0 + 1));
        _update("a", H0 + 1);
    }

    function test_update_trusted_height_mismatch_reverts() public {
        // Precompile says the header builds on H0 - 1 but we passed the state at H0.
        _setUpdate(H0 + 5, T0 + 30e9, bytes32(uint256(2)), H0 - 1);
        vm.expectRevert(
            abi.encodeWithSelector(TendermintLightClient.TrustedHeightMismatch.selector, REVISION, H0, REVISION, H0 - 1)
        );
        _update("a", H0);
    }

    function test_update_revision_change_reverts() public {
        mock.setUpdate(_vcs(T0 + 1e9, 0), ITendermintVerifier.Height(REVISION + 1, H0 + 1), _h(H0));
        vm.expectRevert(
            abi.encodeWithSelector(TendermintLightClient.RevisionNumberMismatch.selector, REVISION, REVISION + 1)
        );
        _update("a", H0);
    }

    function test_update_precompile_revert_bubbles() public {
        mock.setRevert(true);
        vm.expectRevert(ITendermintVerifier.VerificationFailed.selector);
        _update("a", H0);
    }

    function test_update_malformed_msg_reverts() public {
        vm.expectRevert();
        lc.updateClient(hex"deadbeef");
    }

    // ---------- membership ----------

    function test_membership_ok_returns_timestamp_seconds() public {
        mock.setMembership(true);
        ILightClientMsgs.MsgVerifyMembership memory m = _membershipMsg(H0, hex"aabb");
        vm.expectCall(
            address(mock),
            abi.encodeCall(ITendermintVerifier.verifyMembership, (bytes32(uint256(1)), m.proof, m.path, m.value))
        );
        uint256 ts = lc.verifyMembership(m);
        assertEq(ts, T0 / 1e9);
    }

    function test_membership_false_reverts() public {
        mock.setMembership(false);
        vm.expectRevert(TendermintLightClient.MembershipVerificationFailed.selector);
        lc.verifyMembership(_membershipMsg(H0, hex"aabb"));
    }

    function test_membership_empty_value_reverts() public {
        vm.expectRevert(TendermintLightClient.EmptyValue.selector);
        lc.verifyMembership(_membershipMsg(H0, ""));
    }

    function test_membership_unknown_height_reverts() public {
        mock.setMembership(true);
        vm.expectRevert(abi.encodeWithSelector(TendermintLightClient.ConsensusStateNotFound.selector, H0 + 1));
        lc.verifyMembership(_membershipMsg(H0 + 1, hex"aa"));
    }

    function test_membership_wrong_revision_reverts() public {
        mock.setMembership(true);
        ILightClientMsgs.MsgVerifyMembership memory m = _membershipMsg(H0, hex"aa");
        m.proofHeight.revisionNumber = REVISION + 1;
        vm.expectRevert(
            abi.encodeWithSelector(TendermintLightClient.RevisionNumberMismatch.selector, REVISION, REVISION + 1)
        );
        lc.verifyMembership(m);
    }

    function test_membership_expired_client_reverts() public {
        mock.setMembership(true);
        vm.warp(T0 / 1e9 + TRUSTING);
        vm.expectRevert(abi.encodeWithSelector(TendermintLightClient.ClientExpired.selector, T0 / 1e9, TRUSTING));
        lc.verifyMembership(_membershipMsg(H0, hex"aa"));

        vm.warp(T0 / 1e9 + TRUSTING - 1);
        lc.verifyMembership(_membershipMsg(H0, hex"aa"));
    }

    function test_non_membership() public {
        mock.setMembership(true);
        ILightClientMsgs.MsgVerifyNonMembership memory m;
        m.proof = hex"0a00";
        m.proofHeight = IICS02ClientMsgs.Height(REVISION, H0);
        m.path = new bytes[](1);
        m.path[0] = "ibc";
        vm.expectCall(
            address(mock),
            abi.encodeCall(ITendermintVerifier.verifyMembership, (bytes32(uint256(1)), m.proof, m.path, bytes("")))
        );
        assertEq(lc.verifyNonMembership(m), T0 / 1e9);

        mock.setMembership(false);
        vm.expectRevert(TendermintLightClient.MembershipVerificationFailed.selector);
        lc.verifyNonMembership(m);
    }

    // ---------- misbehaviour ----------

    function _mb(uint64 t1, uint64 t2) internal pure returns (bytes memory) {
        return abi.encode(TendermintLightClient.MsgSubmitMisbehaviour("h1", "h2", t1, t2));
    }

    function test_misbehaviour_freezes() public {
        mock.setMisbehaviour(true, _h(H0), _h(H0));
        lc.misbehaviour(_mb(H0, H0));
        IICS07TendermintMsgs.ClientState memory cs = abi.decode(lc.getClientState(), (IICS07TendermintMsgs.ClientState));
        assertTrue(cs.isFrozen);
    }

    function test_misbehaviour_not_detected_reverts() public {
        mock.setMisbehaviour(false, _h(H0), _h(H0));
        vm.expectRevert(TendermintLightClient.MisbehaviourNotDetected.selector);
        lc.misbehaviour(_mb(H0, H0));
    }

    function test_misbehaviour_trusted_height_mismatch_reverts() public {
        mock.setMisbehaviour(true, _h(H0), _h(H0 - 1));
        vm.expectRevert(
            abi.encodeWithSelector(TendermintLightClient.TrustedHeightMismatch.selector, REVISION, H0, REVISION, H0 - 1)
        );
        lc.misbehaviour(_mb(H0, H0));
    }

    function test_misbehaviour_unknown_trusted_state_reverts() public {
        vm.expectRevert(abi.encodeWithSelector(TendermintLightClient.ConsensusStateNotFound.selector, H0 + 7));
        lc.misbehaviour(_mb(H0 + 7, H0));
    }

    function test_misbehaviour_precompile_revert_bubbles() public {
        mock.setRevert(true);
        vm.expectRevert(ITendermintVerifier.VerificationFailed.selector);
        lc.misbehaviour(_mb(H0, H0));
    }

    // ---------- real precompile address ----------

    function test_talks_to_precompile_address() public {
        assertEq(TENDERMINT_VERIFIER, address(uint160(0x544D564552)));
        vm.etch(TENDERMINT_VERIFIER, address(mock).code);
        TendermintLightClient c = _deploy(TENDERMINT_VERIFIER);
        MockTendermintVerifier(TENDERMINT_VERIFIER).setMembership(true);

        ILightClientMsgs.MsgVerifyMembership memory m = _membershipMsg(H0, hex"aa");
        assertEq(c.verifyMembership(m), T0 / 1e9);
    }
}
