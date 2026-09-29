// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

// Stateless CometBFT light client verifier precompile. Mirrors
// crates/contracts/src/precompiles/tendermint_verifier.rs.
address constant TENDERMINT_VERIFIER = 0x000000000000000000000000000000544D564552;

interface ITendermintVerifier {
    struct Params {
        string chainId;
        uint64 trustNumerator;
        uint64 trustDenominator;
        uint64 trustingPeriod;
        uint64 unbondingPeriod;
        uint64 maxClockDrift;
    }

    /// @dev Same layout as SP1ICS07Tendermint's ConsensusState. Timestamp is unix nanoseconds.
    struct ConsensusState {
        uint128 timestamp;
        bytes32 root;
        bytes32 nextValidatorsHash;
    }

    struct Height {
        uint64 revisionNumber;
        uint64 revisionHeight;
    }

    error InvalidInput();
    error VerificationFailed();

    /// @notice Verifies a protobuf tendermint Header against `trusted`. Reverts if invalid.
    function verifyUpdate(
        Params calldata params,
        ConsensusState calldata trusted,
        bytes calldata header,
        uint64 nowSeconds
    )
        external
        view
        returns (ConsensusState memory newConsensusState, Height memory newHeight, Height memory trustedHeight);

    /// @notice ICS-23 (non)membership under `root`. Empty `value` means non-membership.
    function verifyMembership(bytes32 root, bytes calldata proof, bytes[] calldata path, bytes calldata value)
        external
        view
        returns (bool);

    /// @notice Checks two headers for conflicting commits. Reverts if either header is invalid.
    function checkMisbehaviour(
        Params calldata params,
        ConsensusState calldata trusted1,
        ConsensusState calldata trusted2,
        bytes calldata header1,
        bytes calldata header2,
        uint64 nowSeconds
    ) external view returns (bool detected, Height memory trustedHeight1, Height memory trustedHeight2);
}
