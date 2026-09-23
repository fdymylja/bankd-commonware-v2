// SPDX-License-Identifier: MIT OR Apache-2.0
//! ABI types for ICS26Router and CommonwareLightClient (contracts/).

use alloy::sol;

sol! {
    #[derive(Debug)]
    struct Height { uint64 revisionNumber; uint64 revisionHeight; }

    #[derive(Debug)]
    struct Payload { string sourcePort; string destPort; string version; string encoding; bytes value; }

    #[derive(Debug)]
    struct Packet {
        uint64 sequence;
        string sourceClient;
        string destClient;
        uint64 timeoutTimestamp;
        Payload[] payloads;
    }

    struct MsgRecvPacket { Packet packet; bytes proofCommitment; Height proofHeight; }
    struct MsgAckPacket { Packet packet; bytes acknowledgement; bytes proofAcked; Height proofHeight; }

    /// EIP-2537 G2 point, each 48-byte field split into hi (16 bytes, zero padded) and lo words.
    #[derive(Default)]
    struct G2Point {
        bytes32 xC0Hi; bytes32 xC0Lo; bytes32 xC1Hi; bytes32 xC1Lo;
        bytes32 yC0Hi; bytes32 yC0Lo; bytes32 yC1Hi; bytes32 yC1Lo;
    }

    /// CommonwareLightClient.MsgUpdateClient
    struct MsgUpdateClient {
        bytes headerRlp;
        uint64 viewNumber;
        uint64 parentView;
        bytes signature;
        G2Point nextGroupKey;
    }

    /// CommonwareLightClient.MembershipProof
    struct MembershipProof { bytes[] accountProof; bytes[] storageProof; }

    /// CommonwareLightClient.ClientState
    struct ClientState { address ibcRouter; Height latestHeight; uint64 epochLength; bool frozen; }

    #[sol(rpc)]
    interface CommonwareLightClient {
        function getClientState() external view returns (bytes memory);
        function getConsensusState(uint64 height) external view returns (uint64 timestamp, bytes32 stateRoot);
    }

    #[sol(rpc)]
    interface ICS26Router {
        event SendPacket(string indexed clientId, uint256 indexed sequence, Packet packet);
        event WriteAcknowledgement(string indexed clientId, uint256 indexed sequence, Packet packet, bytes[] acknowledgements);

        function updateClient(string calldata clientId, bytes calldata updateMsg) external returns (uint8);
        function getClient(string calldata clientId) external view returns (address);
        function getCommitment(bytes32 hashedPath) external view returns (bytes32);
        function recvPacket(MsgRecvPacket calldata msg_) external;
        function ackPacket(MsgAckPacket calldata msg_) external;
    }
}
