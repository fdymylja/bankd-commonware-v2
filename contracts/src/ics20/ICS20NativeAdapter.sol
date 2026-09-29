// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { Ownable } from "@openzeppelin-contracts/access/Ownable.sol";
import { Strings } from "@openzeppelin-contracts/utils/Strings.sol";

import { IIBCApp } from "@ibc/contracts/interfaces/IIBCApp.sol";
import { IICS26Router } from "@ibc/contracts/interfaces/IICS26Router.sol";
import { IIBCAppCallbacks } from "@ibc/contracts/msgs/IIBCAppCallbacks.sol";
import { IICS26RouterMsgs } from "@ibc/contracts/msgs/IICS26RouterMsgs.sol";
import { IICS20TransferMsgs } from "@ibc/contracts/msgs/IICS20TransferMsgs.sol";
import { ICS20Lib } from "@ibc/contracts/utils/ICS20Lib.sol";
import { ICS24Host } from "@ibc/contracts/utils/ICS24Host.sol";

import { INative, NATIVE_PRECOMPILE } from "./INative.sol";

/// @title ICS20NativeAdapter
/// @notice ICS20 (IBC v2) app that moves native BRL between bankd chains with no vouchers.
/// @dev Uses the stock ICS20 wire format (ics20-1, solidity-abi FungibleTokenPacketData) with denom "ujuno".
/// Native has 18 decimals, packets carry 6 (ujuno), so wei = packet amount * 1e12.
/// - Hub (central bank): escrows msg.value per client on send, releases on receive-back. Returns
///   come as "ujuno" from bankd spokes, or as the "transfer/{client}/ujuno" voucher trace from stock
///   ICS20 chains (e.g. a Cosmos hub).
/// - Spoke: burns msg.value on send, mints through the Native precompile on receive, but only for
///   packets arriving on an allow-listed local client (the one tracking the hub).
/// Invariant: a spoke's bridged supply equals the hub's escrow for that spoke's client.
contract ICS20NativeAdapter is IIBCApp, Ownable {
    enum Mode {
        Hub,
        Spoke
    }

    string public constant DENOM = "ujuno";
    bytes32 private constant DENOM_HASH = keccak256("ujuno");
    /// @notice wei per packet unit. Native is 18 decimals, ujuno is 6.
    uint256 public constant SCALE = 1e12;

    IICS26Router public immutable ROUTER;
    Mode public immutable MODE;

    /// @notice Hub only: native BRL held for each local client (one per spoke).
    mapping(string clientId => uint256 amount) public escrowed;
    /// @notice Spoke only: local client ids whose counterparty is the hub.
    mapping(string clientId => bool trusted) public trustedClients;

    event TransferSent(string clientId, uint64 sequence, address indexed sender, string receiver, uint256 amount);
    event TransferReceived(string clientId, uint64 sequence, address indexed receiver, uint256 amount);
    event TransferRefunded(string clientId, uint64 sequence, address indexed sender, uint256 amount);
    event TrustedClientSet(string clientId, bool trusted);

    error OnlyRouter();
    error ZeroAmount();
    error DustAmount(uint256 value);
    error UntrustedClient(string clientId);
    error InvalidPayload();
    error InvalidDenom(string denom);
    error InvalidPort(string sourcePort, string destPort);
    error InsufficientEscrow(string clientId, uint256 escrow, uint256 amount);
    error NativeCallFailed();
    error NativeTransferFailed(address to);

    modifier onlyRouter() {
        require(msg.sender == address(ROUTER), OnlyRouter());
        _;
    }

    constructor(IICS26Router router, Mode mode, address owner) Ownable(owner) {
        ROUTER = router;
        MODE = mode;
    }

    /// @notice Spoke only: allow or revoke a local client as the hub route.
    function setTrustedClient(string calldata clientId, bool trusted) external onlyOwner {
        trustedClients[clientId] = trusted;
        emit TrustedClientSet(clientId, trusted);
    }

    /// @notice Sends msg.value native BRL over `clientId` to `receiver` (0x hex address on the other chain).
    function sendTransfer(
        string calldata clientId,
        string calldata receiver,
        uint64 timeoutTimestamp,
        string calldata memo
    ) external payable returns (uint64 sequence) {
        require(msg.value != 0, ZeroAmount());
        require(msg.value % SCALE == 0, DustAmount(msg.value));
        if (MODE == Mode.Hub) {
            escrowed[clientId] += msg.value;
        } else {
            // Spokes only route through the hub. It is the only side that can release escrow.
            require(trustedClients[clientId], UntrustedClient(clientId));
            _native(abi.encodeCall(INative.burn, (address(this), msg.value)));
        }

        IICS20TransferMsgs.FungibleTokenPacketData memory data = IICS20TransferMsgs.FungibleTokenPacketData({
            denom: DENOM,
            sender: Strings.toHexString(msg.sender),
            receiver: receiver,
            amount: msg.value / SCALE,
            memo: memo
        });
        sequence = ROUTER.sendPacket(
            IICS26RouterMsgs.MsgSendPacket({
                sourceClient: clientId,
                timeoutTimestamp: timeoutTimestamp,
                payload: IICS26RouterMsgs.Payload({
                    sourcePort: ICS20Lib.DEFAULT_PORT_ID,
                    destPort: ICS20Lib.DEFAULT_PORT_ID,
                    version: ICS20Lib.ICS20_VERSION,
                    encoding: ICS20Lib.ICS20_ENCODING,
                    value: abi.encode(data)
                })
            })
        );
        emit TransferSent(clientId, sequence, msg.sender, receiver, msg.value);
    }

    /// @inheritdoc IIBCApp
    function onRecvPacket(IIBCAppCallbacks.OnRecvPacketCallback calldata msg_)
        external
        onlyRouter
        returns (bytes memory)
    {
        IICS20TransferMsgs.FungibleTokenPacketData memory data = _decode(msg_.payload);
        address receiver = ICS20Lib.mustHexStringToAddress(data.receiver);

        if (MODE == Mode.Hub) {
            // The prefix must name the sending chain's own client, so a voucher can only unwind
            // over the client it left on. _release caps it at that client's escrow either way.
            bytes32 d = keccak256(bytes(data.denom));
            require(
                d == DENOM_HASH || d == keccak256(abi.encodePacked("transfer/", msg_.sourceClient, "/", DENOM)),
                InvalidDenom(data.denom)
            );
            _release(msg_.destinationClient, receiver, data.amount * SCALE);
        } else {
            require(keccak256(bytes(data.denom)) == DENOM_HASH, InvalidDenom(data.denom));
            require(trustedClients[msg_.destinationClient], UntrustedClient(msg_.destinationClient));
            _native(abi.encodeCall(INative.mint, (receiver, data.amount * SCALE)));
        }
        emit TransferReceived(msg_.destinationClient, msg_.sequence, receiver, data.amount * SCALE);
        return ICS20Lib.SUCCESSFUL_ACKNOWLEDGEMENT_JSON;
    }

    /// @inheritdoc IIBCApp
    function onAcknowledgementPacket(IIBCAppCallbacks.OnAcknowledgementPacketCallback calldata msg_)
        external
        onlyRouter
    {
        if (keccak256(msg_.acknowledgement) == ICS24Host.KECCAK256_UNIVERSAL_ERROR_ACK) {
            _refund(msg_.sourceClient, msg_.sequence, msg_.payload);
        }
    }

    /// @inheritdoc IIBCApp
    function onTimeoutPacket(IIBCAppCallbacks.OnTimeoutPacketCallback calldata msg_) external onlyRouter {
        _refund(msg_.sourceClient, msg_.sequence, msg_.payload);
    }

    /// @dev Undo a failed send: hub releases its own escrow, spoke re-mints what it burned.
    function _refund(string calldata clientId, uint64 sequence, IICS26RouterMsgs.Payload calldata payload) private {
        IICS20TransferMsgs.FungibleTokenPacketData memory data = _decode(payload);
        // We only ever send bare "ujuno".
        require(keccak256(bytes(data.denom)) == DENOM_HASH, InvalidDenom(data.denom));
        address sender = ICS20Lib.mustHexStringToAddress(data.sender);
        if (MODE == Mode.Hub) {
            _release(clientId, sender, data.amount * SCALE);
        } else {
            _native(abi.encodeCall(INative.mint, (sender, data.amount * SCALE)));
        }
        emit TransferRefunded(clientId, sequence, sender, data.amount * SCALE);
    }

    function _release(string calldata clientId, address to, uint256 amount) private {
        uint256 escrow = escrowed[clientId];
        require(escrow >= amount, InsufficientEscrow(clientId, escrow, amount));
        escrowed[clientId] = escrow - amount;
        (bool ok,) = to.call{ value: amount }("");
        require(ok, NativeTransferFailed(to));
    }

    function _decode(IICS26RouterMsgs.Payload calldata payload)
        private
        pure
        returns (IICS20TransferMsgs.FungibleTokenPacketData memory data)
    {
        // Ports are permissionless on the router, so a packet from any other port could mint or release BRL.
        require(
            keccak256(bytes(payload.sourcePort)) == ICS20Lib.KECCAK256_DEFAULT_PORT_ID
                && keccak256(bytes(payload.destPort)) == ICS20Lib.KECCAK256_DEFAULT_PORT_ID,
            InvalidPort(payload.sourcePort, payload.destPort)
        );
        require(
            keccak256(bytes(payload.version)) == ICS20Lib.KECCAK256_ICS20_VERSION
                && keccak256(bytes(payload.encoding)) == ICS20Lib.KECCAK256_ICS20_ENCODING,
            InvalidPayload()
        );
        data = abi.decode(payload.value, (IICS20TransferMsgs.FungibleTokenPacketData));
        require(data.amount != 0, ZeroAmount());
    }

    /// @dev The precompile returns `bool success`. Requiring 32 bytes of `true` also catches a
    /// missing precompile, since a call to an empty address succeeds with no return data.
    function _native(bytes memory call) private {
        (bool ok, bytes memory ret) = NATIVE_PRECOMPILE.call(call);
        require(ok && ret.length == 32 && abi.decode(ret, (bool)), NativeCallFailed());
    }
}
