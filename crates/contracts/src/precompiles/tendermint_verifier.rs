pub use ITendermintVerifier::ITendermintVerifierErrors as TendermintVerifierError;

crate::sol! {
    /// Stateless CometBFT light client verifier. Pure functions, no storage. Clients keep their
    /// own state and pass the trusted consensus state in on every call.
    #[derive(Debug, PartialEq, Eq)]
    #[sol(abi)]
    interface ITendermintVerifier {
        /// Client parameters. Same meaning as the ibc tendermint ClientState.
        struct Params {
            string chainId;
            uint64 trustNumerator;
            uint64 trustDenominator;
            uint64 trustingPeriod;
            uint64 unbondingPeriod;
            uint64 maxClockDrift;
        }

        /// Same layout as SP1ICS07Tendermint's ConsensusState. Timestamp is unix nanoseconds.
        struct ConsensusState {
            uint128 timestamp;
            bytes32 root;
            bytes32 nextValidatorsHash;
        }

        struct Height {
            uint64 revisionNumber;
            uint64 revisionHeight;
        }

        /// Verifies `header` (protobuf ibc.lightclients.tendermint.v1.Header) against `trusted`.
        /// Reverts if invalid. The caller must check `trusted` is the stored state at
        /// `trustedHeight`. `nowSeconds` is the caller's block timestamp.
        function verifyUpdate(
            Params calldata params,
            ConsensusState calldata trusted,
            bytes calldata header,
            uint64 nowSeconds
        ) external view returns (
            ConsensusState memory newConsensusState,
            Height memory newHeight,
            Height memory trustedHeight
        );

        /// ICS-23 (non)membership of `path` under `root`. `proof` is a protobuf MerkleProof.
        /// An empty `value` means non-membership. Returns false when the proof does not verify.
        function verifyMembership(
            bytes32 root,
            bytes calldata proof,
            bytes[] calldata path,
            bytes calldata value
        ) external view returns (bool);

        /// Checks two headers for conflicting commits. Reverts if either header is invalid.
        /// `detected` is false when both are valid and consistent.
        function checkMisbehaviour(
            Params calldata params,
            ConsensusState calldata trusted1,
            ConsensusState calldata trusted2,
            bytes calldata header1,
            bytes calldata header2,
            uint64 nowSeconds
        ) external view returns (bool detected, Height memory trustedHeight1, Height memory trustedHeight2);

        /// Input is malformed or over the size limits.
        error InvalidInput();
        /// Header or misbehaviour evidence did not verify.
        error VerificationFailed();
    }
}
