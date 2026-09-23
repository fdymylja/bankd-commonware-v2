// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { RLP } from "@openzeppelin-contracts/utils/RLP.sol";
import { Memory } from "@openzeppelin-contracts/utils/Memory.sol";

import { ILightClient } from "@ibc/contracts/interfaces/ILightClient.sol";
import { ILightClientMsgs } from "@ibc/contracts/msgs/ILightClientMsgs.sol";
import { IICS02ClientMsgs } from "@ibc/contracts/msgs/IICS02ClientMsgs.sol";
import { TrieProof } from "@ibc/contracts/utils/TrieProof.sol";

import { LibBLS12381 as BLS } from "@commonware/certificate/LibBLS12381.sol";
import { LibSimplex as Simplex } from "@commonware/simplex/LibSimplex.sol";
import { LibSimplexBLS12381Threshold as Threshold } from "@commonware/simplex/LibSimplexBLS12381Threshold.sol";

import { TempoHeaderLib } from "./TempoHeaderLib.sol";
import { G2Lib } from "./G2Lib.sol";

/// @title CommonwareLightClient
/// @notice IBC v2 light client for a tempo (reth + commonware simplex) chain.
/// @dev Trust model: a BLS12-381 MinSig threshold finalization over keccak(rlp(TempoHeader)), checked
/// against the group key of the header's epoch. Group keys rotate at epoch boundaries, where the last
/// block of epoch e carries epoch e+1's DKG outcome in extra_data. Ported from tempo's
/// crates/consensus/src/finalization_verifier.
contract CommonwareLightClient is ILightClient {
    using RLP for Memory.Slice;

    /// @param ibcRouter Counterparty ICS26Router (proxy) whose storage is proven.
    /// @param latestHeight Highest finalized height seen.
    /// @param epochLength Blocks per epoch on the counterparty (tempo FixedEpocher).
    /// @param frozen Set once two different finalized headers were seen for one height.
    struct ClientState {
        address ibcRouter;
        IICS02ClientMsgs.Height latestHeight;
        uint64 epochLength;
        bool frozen;
    }

    struct ConsensusState {
        uint64 timestamp;
        bytes32 stateRoot;
    }

    /// @notice Update message, passed ABI-encoded to `updateClient`.
    /// @param headerRlp RLP-encoded TempoHeader. Its keccak is the certified payload digest.
    /// @param viewNumber The finalized view (round) of the proposal.
    /// @param parentView The proposal's parent view.
    /// @param signature Recovered threshold vote signature, uncompressed G1 `x || y` (96 bytes).
    /// @param nextGroupKey Only read for boundary headers: the uncompressed key of the next epoch,
    /// checked against the compressed identity inside extra_data.
    struct MsgUpdateClient {
        bytes headerRlp;
        uint64 viewNumber;
        uint64 parentView;
        bytes signature;
        BLS.G2Point nextGroupKey;
    }

    /// @notice Proof for verify(Non)Membership, from eth_getProof on the counterparty router.
    struct MembershipProof {
        bytes[] accountProof;
        bytes[] storageProof;
    }

    /// @dev ERC-7201 slot of IBCStoreUpgradeable, same constant the Besu client uses.
    bytes32 private constant IBCSTORE_STORAGE_SLOT = 0x1260944489272988d9df285149b5aa1b0f48f2136d6f416159f840a3e0747600;

    ClientState private _clientState;
    /// @notice Simplex base namespace of the counterparty chain (tempo uses "TEMPO").
    bytes public namespace;
    mapping(uint64 epoch => BLS.G2Point key) private _groupKeys;
    mapping(uint64 height => ConsensusState) private _consensusStates;

    event GroupKeyRegistered(uint64 indexed epoch);
    event ConsensusStateAdded(uint64 indexed height, bytes32 stateRoot, uint64 timestamp);
    event ClientFrozen(uint64 indexed height);

    error ClientIsFrozen();
    error InvalidEpochLength();
    error InvalidGroupKey();
    error UnknownEpoch(uint64 epoch);
    error StaleEpoch(uint64 epoch, uint64 latestEpoch);
    error ContextMismatch();
    error InvalidCertificate();
    error DkgOutcomeEpochMismatch(uint64 expected, uint64 actual);
    error GroupKeyMismatch();
    error InvalidRevisionNumber();
    error InvalidPathLength();
    error InvalidValueLength();
    error ConsensusStateNotFound(uint64 height);
    error InvalidCommitmentValue(bytes32 expected, bytes32 actual);
    error InvalidExclusionProof();
    error UnsupportedMisbehaviour();

    /// @param ibcRouter Counterparty ICS26Router address.
    /// @param namespace_ Counterparty simplex namespace.
    /// @param epochLength Counterparty epoch length in blocks.
    /// @param trustedEpoch Epoch whose group key is trusted at genesis of this client.
    /// @param trustedKey That epoch's group key (the network identity), uncompressed.
    constructor(
        address ibcRouter,
        bytes memory namespace_,
        uint64 epochLength,
        uint64 trustedEpoch,
        BLS.G2Point memory trustedKey
    ) {
        require(epochLength != 0, InvalidEpochLength());
        require(G2Lib.isOnCurve(trustedKey), InvalidGroupKey());
        _clientState.ibcRouter = ibcRouter;
        _clientState.epochLength = epochLength;
        // Start latestHeight at the trusted epoch so older epochs can't be updated.
        _clientState.latestHeight.revisionHeight = trustedEpoch * epochLength;
        namespace = namespace_;
        _groupKeys[trustedEpoch] = trustedKey;
        emit GroupKeyRegistered(trustedEpoch);
    }

    /// @inheritdoc ILightClient
    function getClientState() external view returns (bytes memory) {
        return abi.encode(_clientState);
    }

    /// @notice Trusted consensus state at `height`, zero if unknown.
    function getConsensusState(uint64 height) external view returns (ConsensusState memory) {
        return _consensusStates[height];
    }

    /// @notice Trusted group key for `epoch`, zero if unknown.
    function getGroupKey(uint64 epoch) external view returns (BLS.G2Point memory) {
        return _groupKeys[epoch];
    }

    /// @inheritdoc ILightClient
    function updateClient(bytes calldata updateMsg) external returns (ILightClientMsgs.UpdateResult) {
        ClientState memory cs = _clientState;
        require(!cs.frozen, ClientIsFrozen());

        MsgUpdateClient calldata m = _decodeUpdate(updateMsg);
        TempoHeaderLib.Header memory h = TempoHeaderLib.decode(m.headerRlp);

        uint64 epoch = h.number / cs.epochLength;
        // Only accept the current or newer epochs. An old committee could still sign for its epoch
        // after it rotated out, so refusing older epochs limits that long-range window.
        uint64 latestEpoch = cs.latestHeight.revisionHeight / cs.epochLength;
        require(epoch >= latestEpoch, StaleEpoch(epoch, latestEpoch));
        if (h.hasContext) {
            require(
                h.ctxEpoch == epoch && h.ctxView == m.viewNumber && h.ctxParentView == m.parentView, ContextMismatch()
            );
        }

        BLS.G2Point memory key = _groupKeys[epoch];
        require(_isSet(key), UnknownEpoch(epoch));

        Simplex.Subject memory subject = Simplex.Subject({
            kind: Simplex.Kind.Finalization,
            epoch: epoch,
            viewNumber: m.viewNumber,
            parent: m.parentView,
            payload: keccak256(m.headerRlp)
        });
        require(Threshold.verifyMinSig(m.signature, key, namespace, subject), InvalidCertificate());

        ConsensusState memory next = ConsensusState({ timestamp: h.timestamp, stateRoot: h.stateRoot });
        ConsensusState memory existing = _consensusStates[h.number];
        if (existing.stateRoot != bytes32(0)) {
            if (existing.stateRoot == next.stateRoot && existing.timestamp == next.timestamp) {
                return ILightClientMsgs.UpdateResult.NoOp;
            }
            // Two finalized blocks at one height means the counterparty's BFT safety broke.
            _clientState.frozen = true;
            emit ClientFrozen(h.number);
            return ILightClientMsgs.UpdateResult.Misbehaviour;
        }

        if (h.number % cs.epochLength == cs.epochLength - 1) {
            _registerNextKey(epoch, h.extraData, m.nextGroupKey);
        }

        _consensusStates[h.number] = next;
        if (h.number > cs.latestHeight.revisionHeight) {
            _clientState.latestHeight.revisionHeight = h.number;
        }
        emit ConsensusStateAdded(h.number, next.stateRoot, next.timestamp);
        return ILightClientMsgs.UpdateResult.Update;
    }

    /// @inheritdoc ILightClient
    function verifyMembership(ILightClientMsgs.MsgVerifyMembership calldata msg_) external view returns (uint256) {
        require(msg_.value.length == 32, InvalidValueLength());
        (ConsensusState memory cs, bytes32 storageRoot, bytes memory key, MembershipProof memory proof) =
            _prepare(msg_.proofHeight, msg_.path, msg_.proof);

        bytes32 actual = RLP.decodeBytes32(TrieProof.traverse(storageRoot, key, proof.storageProof));
        bytes32 expected = bytes32(msg_.value);
        require(actual == expected, InvalidCommitmentValue(expected, actual));
        return cs.timestamp;
    }

    /// @inheritdoc ILightClient
    function verifyNonMembership(ILightClientMsgs.MsgVerifyNonMembership calldata msg_)
        external
        view
        returns (uint256)
    {
        (ConsensusState memory cs, bytes32 storageRoot, bytes memory key, MembershipProof memory proof) =
            _prepare(msg_.proofHeight, msg_.path, msg_.proof);
        require(TrieProof.verifyExclusion(storageRoot, key, proof.storageProof), InvalidExclusionProof());
        return cs.timestamp;
    }

    /// @inheritdoc ILightClient
    /// @dev Conflicting headers already freeze the client inside updateClient.
    function misbehaviour(bytes calldata) external pure {
        revert UnsupportedMisbehaviour();
    }

    /// @notice Installs epoch+1's key from a boundary header after checking it against extra_data.
    function _registerNextKey(uint64 epoch, bytes memory extraData, BLS.G2Point calldata nextKey) private {
        (uint64 outcomeEpoch, bytes memory identity) = TempoHeaderLib.readDkgOutcome(extraData);
        require(outcomeEpoch == epoch + 1, DkgOutcomeEpochMismatch(epoch + 1, outcomeEpoch));
        BLS.G2Point memory k = nextKey;
        require(G2Lib.isOnCurve(k), InvalidGroupKey());
        require(keccak256(G2Lib.compress(k)) == keccak256(identity), GroupKeyMismatch());
        _groupKeys[outcomeEpoch] = k;
        emit GroupKeyRegistered(outcomeEpoch);
    }

    /// @dev Shared checks for (non)membership: trusted state root, router account proof, storage key.
    function _prepare(IICS02ClientMsgs.Height calldata height, bytes[] calldata path, bytes calldata rawProof)
        private
        view
        returns (ConsensusState memory cs, bytes32 storageRoot, bytes memory key, MembershipProof memory proof)
    {
        require(!_clientState.frozen, ClientIsFrozen());
        require(height.revisionNumber == 0, InvalidRevisionNumber());
        require(path.length == 1, InvalidPathLength());
        cs = _consensusStates[height.revisionHeight];
        require(cs.stateRoot != bytes32(0), ConsensusStateNotFound(height.revisionHeight));

        proof = abi.decode(rawProof, (MembershipProof));
        bytes memory accountKey = abi.encodePacked(keccak256(abi.encodePacked(_clientState.ibcRouter)));
        Memory.Slice[] memory account = RLP.decodeList(TrieProof.traverse(cs.stateRoot, accountKey, proof.accountProof));
        storageRoot = account[2].readBytes32();

        bytes32 slot = keccak256(abi.encode(keccak256(path[0]), IBCSTORE_STORAGE_SLOT));
        key = abi.encodePacked(keccak256(abi.encodePacked(slot)));
    }

    /// @dev The commonware verifier wants the signature as calldata, so point a calldata struct at
    /// the ABI-encoded message instead of copying it to memory with abi.decode.
    function _decodeUpdate(bytes calldata updateMsg) private pure returns (MsgUpdateClient calldata m) {
        assembly ("memory-safe") {
            m := add(updateMsg.offset, calldataload(updateMsg.offset))
        }
    }

    function _isSet(BLS.G2Point memory k) private pure returns (bool) {
        return k.xC0Lo != 0 || k.xC0Hi != 0 || k.xC1Lo != 0 || k.xC1Hi != 0;
    }
}
