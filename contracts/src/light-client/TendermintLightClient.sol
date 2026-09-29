// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { ILightClient } from "@ibc/contracts/interfaces/ILightClient.sol";
import { ILightClientMsgs } from "@ibc/contracts/msgs/ILightClientMsgs.sol";
import { IICS02ClientMsgs } from "@ibc/contracts/msgs/IICS02ClientMsgs.sol";
import { IICS07TendermintMsgs } from "@ibc/contracts/light-clients/sp1-ics07/msgs/IICS07TendermintMsgs.sol";

import { ITendermintVerifier } from "./ITendermintVerifier.sol";

/// @title TendermintLightClient
/// @notice IBC v2 light client for a CometBFT chain, verified natively by the TendermintVerifier
/// precompile instead of an SP1 proof. Modelled on SP1ICS07Tendermint.
/// @dev State lives here, the precompile is stateless. Client and consensus state types are the
/// SP1ICS07Tendermint ones so existing tooling can read `getClientState`. `zkAlgorithm` is unused.
contract TendermintLightClient is ILightClient {
    /// @notice Max clock drift in seconds, the ibc-go default.
    uint64 public constant MAX_CLOCK_DRIFT = 15;

    /// @notice Update message, ABI-encoded and passed to `updateClient`.
    /// @param header Protobuf ibc.lightclients.tendermint.v1.Header.
    /// @param trustedHeight Revision height of the stored consensus state the header builds on.
    struct MsgUpdateClient {
        bytes header;
        uint64 trustedHeight;
    }

    /// @notice Misbehaviour message, ABI-encoded and passed to `misbehaviour`.
    struct MsgSubmitMisbehaviour {
        bytes header1;
        bytes header2;
        uint64 trustedHeight1;
        uint64 trustedHeight2;
    }

    /// @notice The precompile, or a mock in tests.
    ITendermintVerifier public immutable VERIFIER;

    // natlint-disable-next-line MissingInheritdoc
    IICS07TendermintMsgs.ClientState public clientState;
    /// @dev Revision number is not keyed, it can't change without a new chain id.
    mapping(uint64 revisionHeight => IICS07TendermintMsgs.ConsensusState) private _consensusStates;

    event ConsensusStateAdded(uint64 indexed revisionHeight, bytes32 root, uint128 timestamp);
    event ClientFrozen(uint64 indexed revisionHeight);

    error FrozenClientState();
    error ClientExpired(uint256 latestTimestamp, uint256 trustingPeriod);
    error InvalidChainId();
    error InvalidTrustLevel(uint8 numerator, uint8 denominator);
    error InvalidTrustingPeriod(uint32 trustingPeriod, uint32 unbondingPeriod);
    error InvalidInitialState();
    error ConsensusStateNotFound(uint64 revisionHeight);
    error TrustedHeightMismatch(
        uint64 expectedRevisionNumber, uint64 expectedHeight, uint64 gotRevisionNumber, uint64 gotHeight
    );
    error RevisionNumberMismatch(uint64 expected, uint64 actual);
    error EmptyValue();
    error MembershipVerificationFailed();
    error MisbehaviourNotDetected();

    /// @param verifier The TendermintVerifier precompile address.
    /// @param _clientState Initial client state. `latestHeight` must match `_consensusState`.
    /// @param _consensusState Trusted consensus state at `_clientState.latestHeight`.
    constructor(
        address verifier,
        IICS07TendermintMsgs.ClientState memory _clientState,
        IICS07TendermintMsgs.ConsensusState memory _consensusState
    ) {
        require(bytes(_clientState.chainId).length > 0, InvalidChainId());
        // Trust level must be in [1/3, 1]. The precompile enforces the same, this fails at deploy.
        IICS07TendermintMsgs.TrustThreshold memory t = _clientState.trustLevel;
        require(
            t.denominator != 0 && t.numerator <= t.denominator && uint256(t.numerator) * 3 >= t.denominator,
            InvalidTrustLevel(t.numerator, t.denominator)
        );
        require(
            _clientState.trustingPeriod != 0 && _clientState.trustingPeriod < _clientState.unbondingPeriod,
            InvalidTrustingPeriod(_clientState.trustingPeriod, _clientState.unbondingPeriod)
        );
        require(
            !_clientState.isFrozen && _clientState.latestHeight.revisionHeight != 0 && _consensusState.timestamp != 0,
            InvalidInitialState()
        );

        VERIFIER = ITendermintVerifier(verifier);
        clientState = _clientState;
        _consensusStates[_clientState.latestHeight.revisionHeight] = _consensusState;
    }

    /// @inheritdoc ILightClient
    function getClientState() external view returns (bytes memory) {
        return abi.encode(clientState);
    }

    /// @notice Stored consensus state at `revisionHeight`. Reverts if unknown.
    function getConsensusState(uint64 revisionHeight)
        public
        view
        returns (IICS07TendermintMsgs.ConsensusState memory)
    {
        IICS07TendermintMsgs.ConsensusState memory cs = _consensusStates[revisionHeight];
        require(cs.timestamp != 0, ConsensusStateNotFound(revisionHeight));
        return cs;
    }

    /// @notice keccak256 of the ABI-encoded consensus state, same as SP1ICS07Tendermint.
    function getConsensusStateHash(uint64 revisionHeight) external view returns (bytes32) {
        return keccak256(abi.encode(getConsensusState(revisionHeight)));
    }

    /// @inheritdoc ILightClient
    function updateClient(bytes calldata updateMsg) external notFrozen returns (ILightClientMsgs.UpdateResult) {
        MsgUpdateClient memory m = abi.decode(updateMsg, (MsgUpdateClient));
        IICS07TendermintMsgs.ConsensusState memory trusted = getConsensusState(m.trustedHeight);

        (
            ITendermintVerifier.ConsensusState memory next,
            ITendermintVerifier.Height memory newHeight,
            ITendermintVerifier.Height memory trustedHeight
        ) = VERIFIER.verifyUpdate(_params(), _toVerifier(trusted), m.header, uint64(block.timestamp));

        // The precompile verified against the state we passed. Make sure it's the state the header
        // says it builds on, otherwise a header could be checked against an unrelated trusted state.
        uint64 revision = clientState.latestHeight.revisionNumber;
        require(
            trustedHeight.revisionNumber == revision && trustedHeight.revisionHeight == m.trustedHeight,
            TrustedHeightMismatch(revision, m.trustedHeight, trustedHeight.revisionNumber, trustedHeight.revisionHeight)
        );
        require(newHeight.revisionNumber == revision, RevisionNumberMismatch(revision, newHeight.revisionNumber));

        IICS07TendermintMsgs.ConsensusState memory existing = _consensusStates[newHeight.revisionHeight];
        if (existing.timestamp == 0) {
            _consensusStates[newHeight.revisionHeight] = _fromVerifier(next);
            if (newHeight.revisionHeight > clientState.latestHeight.revisionHeight) {
                clientState.latestHeight = IICS02ClientMsgs.Height(newHeight.revisionNumber, newHeight.revisionHeight);
            }
            emit ConsensusStateAdded(newHeight.revisionHeight, next.root, next.timestamp);
            return ILightClientMsgs.UpdateResult.Update;
        }

        if (
            keccak256(abi.encode(existing)) != keccak256(abi.encode(_fromVerifier(next)))
                || trusted.timestamp >= next.timestamp
        ) {
            // A valid header that conflicts with what we stored, or time going backwards.
            clientState.isFrozen = true;
            emit ClientFrozen(newHeight.revisionHeight);
            return ILightClientMsgs.UpdateResult.Misbehaviour;
        }
        return ILightClientMsgs.UpdateResult.NoOp;
    }

    /// @inheritdoc ILightClient
    function verifyMembership(ILightClientMsgs.MsgVerifyMembership calldata msg_)
        external
        view
        notFrozen
        returns (uint256)
    {
        require(msg_.value.length > 0, EmptyValue());
        return _membership(msg_.proof, msg_.proofHeight, msg_.path, msg_.value);
    }

    /// @inheritdoc ILightClient
    function verifyNonMembership(ILightClientMsgs.MsgVerifyNonMembership calldata msg_)
        external
        view
        notFrozen
        returns (uint256)
    {
        return _membership(msg_.proof, msg_.proofHeight, msg_.path, bytes(""));
    }

    /// @inheritdoc ILightClient
    /// @dev Needs two valid headers that conflict, each built on a stored consensus state.
    function misbehaviour(bytes calldata misbehaviourMsg) external notFrozen {
        MsgSubmitMisbehaviour memory m = abi.decode(misbehaviourMsg, (MsgSubmitMisbehaviour));
        (bool detected, ITendermintVerifier.Height memory h1, ITendermintVerifier.Height memory h2) = VERIFIER
            .checkMisbehaviour(
            _params(),
            _toVerifier(getConsensusState(m.trustedHeight1)),
            _toVerifier(getConsensusState(m.trustedHeight2)),
            m.header1,
            m.header2,
            uint64(block.timestamp)
        );
        require(detected, MisbehaviourNotDetected());

        uint64 revision = clientState.latestHeight.revisionNumber;
        require(
            h1.revisionNumber == revision && h1.revisionHeight == m.trustedHeight1,
            TrustedHeightMismatch(revision, m.trustedHeight1, h1.revisionNumber, h1.revisionHeight)
        );
        require(
            h2.revisionNumber == revision && h2.revisionHeight == m.trustedHeight2,
            TrustedHeightMismatch(revision, m.trustedHeight2, h2.revisionNumber, h2.revisionHeight)
        );

        clientState.isFrozen = true;
        emit ClientFrozen(clientState.latestHeight.revisionHeight);
    }

    /// @dev Returns the consensus state timestamp in unix seconds.
    function _membership(
        bytes calldata proof,
        IICS02ClientMsgs.Height calldata proofHeight,
        bytes[] calldata path,
        bytes memory value
    ) private view returns (uint256) {
        require(
            proofHeight.revisionNumber == clientState.latestHeight.revisionNumber,
            RevisionNumberMismatch(clientState.latestHeight.revisionNumber, proofHeight.revisionNumber)
        );
        // Past the trusting period the validators may have unbonded, so nothing proven from this
        // client is safe anymore. Same as the Active status check in ibc-go.
        IICS07TendermintMsgs.ConsensusState memory latest = getConsensusState(clientState.latestHeight.revisionHeight);
        require(
            block.timestamp < latest.timestamp / 1e9 + clientState.trustingPeriod,
            ClientExpired(latest.timestamp / 1e9, clientState.trustingPeriod)
        );

        IICS07TendermintMsgs.ConsensusState memory cs = getConsensusState(proofHeight.revisionHeight);
        require(VERIFIER.verifyMembership(cs.root, proof, path, value), MembershipVerificationFailed());
        return cs.timestamp / 1e9;
    }

    function _params() private view returns (ITendermintVerifier.Params memory) {
        IICS07TendermintMsgs.ClientState memory cs = clientState;
        return ITendermintVerifier.Params({
            chainId: cs.chainId,
            trustNumerator: cs.trustLevel.numerator,
            trustDenominator: cs.trustLevel.denominator,
            trustingPeriod: cs.trustingPeriod,
            unbondingPeriod: cs.unbondingPeriod,
            maxClockDrift: MAX_CLOCK_DRIFT
        });
    }

    function _toVerifier(IICS07TendermintMsgs.ConsensusState memory cs)
        private
        pure
        returns (ITendermintVerifier.ConsensusState memory)
    {
        return ITendermintVerifier.ConsensusState(cs.timestamp, cs.root, cs.nextValidatorsHash);
    }

    function _fromVerifier(ITendermintVerifier.ConsensusState memory cs)
        private
        pure
        returns (IICS07TendermintMsgs.ConsensusState memory)
    {
        return IICS07TendermintMsgs.ConsensusState(cs.timestamp, cs.root, cs.nextValidatorsHash);
    }

    modifier notFrozen() {
        require(!clientState.isFrozen, FrozenClientState());
        _;
    }
}
