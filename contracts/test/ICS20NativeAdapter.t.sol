// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { Strings } from "@openzeppelin-contracts/utils/Strings.sol";

import { IICS26RouterMsgs } from "@ibc/contracts/msgs/IICS26RouterMsgs.sol";
import { IICS02ClientMsgs } from "@ibc/contracts/msgs/IICS02ClientMsgs.sol";
import { ILightClientMsgs } from "@ibc/contracts/msgs/ILightClientMsgs.sol";
import { IICS20TransferMsgs } from "@ibc/contracts/msgs/IICS20TransferMsgs.sol";
import { ICS20Lib } from "@ibc/contracts/utils/ICS20Lib.sol";
import { ICS24Host } from "@ibc/contracts/utils/ICS24Host.sol";
import { DummyLightClient } from "@ibc/test/solidity-ibc/mocks/DummyLightClient.sol";

import { ICS20NativeAdapter } from "../src/ics20/ICS20NativeAdapter.sol";
import { NATIVE_PRECOMPILE } from "../src/ics20/INative.sol";
import { MockNative } from "./utils/MockNative.sol";
import { IBCDeployer } from "./utils/IBCDeployer.sol";

/// @dev Hub and spoke stacks in one EVM with always-true light clients, relaying by hand. Proof
/// checking is covered by CommonwareLightClientTest and E2ETest.
contract ICS20NativeAdapterTest is Test {
    using IBCDeployer for IBCDeployer.Chain;

    IBCDeployer.Chain internal hub;
    IBCDeployer.Chain internal spoke;
    DummyLightClient internal hubLc; // on hub, tracks spoke
    DummyLightClient internal spokeLc; // on spoke, tracks hub
    string internal hubClient; // hub's client for the spoke
    string internal spokeClient; // spoke's client for the hub

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint64 internal timeout;

    function setUp() public {
        vm.etch(NATIVE_PRECOMPILE, address(new MockNative()).code);

        hub = IBCDeployer.deploy(ICS20NativeAdapter.Mode.Hub, address(this));
        spoke = IBCDeployer.deploy(ICS20NativeAdapter.Mode.Spoke, address(this));
        hubLc = new DummyLightClient(ILightClientMsgs.UpdateResult.Update, uint64(block.timestamp), false);
        spokeLc = new DummyLightClient(ILightClientMsgs.UpdateResult.Update, uint64(block.timestamp), false);

        // Both routers hand out client-0 first, so each side's counterparty id is client-0.
        hubClient = hub.addClient("client-0", address(hubLc));
        spokeClient = spoke.addClient("client-0", address(spokeLc));
        spoke.adapter.setTrustedClient(spokeClient, true);

        timeout = uint64(block.timestamp + 1 hours);
        vm.deal(alice, 100 ether);
    }

    // ---------- relay helpers ----------

    function _packet(string memory src, string memory dst, uint64 seq, address sender, address receiver, uint256 amount)
        internal
        view
        returns (IICS26RouterMsgs.Packet memory p)
    {
        p.sequence = seq;
        p.sourceClient = src;
        p.destClient = dst;
        p.timeoutTimestamp = timeout;
        p.payloads = new IICS26RouterMsgs.Payload[](1);
        p.payloads[0] = IICS26RouterMsgs.Payload({
            sourcePort: ICS20Lib.DEFAULT_PORT_ID,
            destPort: ICS20Lib.DEFAULT_PORT_ID,
            version: ICS20Lib.ICS20_VERSION,
            encoding: ICS20Lib.ICS20_ENCODING,
            value: abi.encode(
                IICS20TransferMsgs.FungibleTokenPacketData({
                    denom: "brl",
                    sender: Strings.toHexString(sender),
                    receiver: Strings.toHexString(receiver),
                    amount: amount,
                    memo: ""
                })
            )
        });
    }

    function _recv(IBCDeployer.Chain memory c, IICS26RouterMsgs.Packet memory p) internal {
        c.router.recvPacket(IICS26RouterMsgs.MsgRecvPacket(p, "", IICS02ClientMsgs.Height(0, 1)));
    }

    function _ack(IBCDeployer.Chain memory c, IICS26RouterMsgs.Packet memory p, bytes memory ack) internal {
        c.router.ackPacket(IICS26RouterMsgs.MsgAckPacket(p, ack, "", IICS02ClientMsgs.Height(0, 1)));
    }

    function _ackCommitment(IBCDeployer.Chain memory c, IICS26RouterMsgs.Packet memory p)
        internal
        view
        returns (bytes32)
    {
        return c.router.getCommitment(ICS24Host.packetAcknowledgementCommitmentKeyCalldata(p.destClient, p.sequence));
    }

    function _hubToSpoke(uint256 amount) internal returns (IICS26RouterMsgs.Packet memory p) {
        vm.prank(alice);
        uint64 seq = hub.adapter.sendTransfer{ value: amount }(hubClient, Strings.toHexString(bob), timeout, "");
        p = _packet(hubClient, spokeClient, seq, alice, bob, amount);
        _recv(spoke, p);
    }

    // ---------- tests ----------

    function test_HubToSpoke_MintsNative() public {
        IICS26RouterMsgs.Packet memory p = _hubToSpoke(5 ether);

        assertEq(alice.balance, 95 ether);
        assertEq(address(hub.adapter).balance, 5 ether);
        assertEq(hub.adapter.escrowed(hubClient), 5 ether);
        assertEq(bob.balance, 5 ether, "bob minted native BRL on spoke");

        // Success ack back to the hub changes nothing.
        _ack(hub, p, ICS20Lib.SUCCESSFUL_ACKNOWLEDGEMENT_JSON);
        assertEq(hub.adapter.escrowed(hubClient), 5 ether);
    }

    function test_SpokeToHub_BurnsAndReleases() public {
        _hubToSpoke(5 ether);

        address carol = makeAddr("carol");
        vm.prank(bob);
        uint64 seq = spoke.adapter.sendTransfer{ value: 2 ether }(spokeClient, Strings.toHexString(carol), timeout, "");
        assertEq(bob.balance, 3 ether);
        assertEq(address(spoke.adapter).balance, 0, "spoke burned, not escrowed");

        _recv(hub, _packet(spokeClient, hubClient, seq, bob, carol, 2 ether));
        assertEq(carol.balance, 2 ether);
        // Invariant: spoke supply (bob's 3) == hub escrow for that spoke.
        assertEq(hub.adapter.escrowed(hubClient), 3 ether);
    }

    function test_SpokeRejectsUntrustedClient() public {
        // Anyone can add a client to the router, so an attacker-controlled LC gets its own id.
        DummyLightClient evil = new DummyLightClient(ILightClientMsgs.UpdateResult.Update, 0, false);
        string memory evilClient = spoke.addClient("client-0", address(evil));

        IICS26RouterMsgs.Packet memory p = _packet("client-0", evilClient, 1, alice, bob, 1000 ether);
        _recv(spoke, p);

        assertEq(bob.balance, 0, "no counterfeit mint");
        bytes[] memory acks = new bytes[](1);
        acks[0] = ICS24Host.UNIVERSAL_ERROR_ACK;
        assertEq(_ackCommitment(spoke, p), ICS24Host.packetAcknowledgementCommitmentBytes32(acks));
    }

    function test_HubRejectsReleaseAboveEscrow() public {
        _hubToSpoke(1 ether);
        IICS26RouterMsgs.Packet memory p = _packet(spokeClient, hubClient, 1, bob, alice, 2 ether);
        _recv(hub, p);
        assertEq(hub.adapter.escrowed(hubClient), 1 ether);
        assertEq(alice.balance, 99 ether);
    }

    function test_HubTimeoutRefunds() public {
        vm.prank(alice);
        uint64 seq = hub.adapter.sendTransfer{ value: 4 ether }(hubClient, Strings.toHexString(bob), timeout, "");
        IICS26RouterMsgs.Packet memory p = _packet(hubClient, spokeClient, seq, alice, bob, 4 ether);

        vm.warp(timeout + 1);
        hubLc.setMembershipResult(timeout + 1, false);
        hub.router.timeoutPacket(IICS26RouterMsgs.MsgTimeoutPacket(p, "", IICS02ClientMsgs.Height(0, 1)));

        assertEq(alice.balance, 100 ether);
        assertEq(hub.adapter.escrowed(hubClient), 0);
    }

    function test_SpokeErrorAckRemints() public {
        _hubToSpoke(5 ether);
        vm.prank(bob);
        uint64 seq = spoke.adapter.sendTransfer{ value: 5 ether }(spokeClient, Strings.toHexString(alice), timeout, "");
        assertEq(bob.balance, 0);

        _ack(spoke, _packet(spokeClient, hubClient, seq, bob, alice, 5 ether), ICS24Host.UNIVERSAL_ERROR_ACK);
        assertEq(bob.balance, 5 ether);
    }

    function test_RevertWhen_SpokeSendsToUntrustedClient() public {
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(ICS20NativeAdapter.UntrustedClient.selector, "client-9"));
        spoke.adapter.sendTransfer{ value: 1 ether }("client-9", Strings.toHexString(alice), timeout, "");
    }

    function test_RevertWhen_NotRouter() public {
        IICS26RouterMsgs.Packet memory p = _packet(hubClient, spokeClient, 1, alice, bob, 1 ether);
        vm.expectRevert(ICS20NativeAdapter.OnlyRouter.selector);
        spoke.adapter.onRecvPacket(IIBCAppCallbacksShim.recv(p));
    }

    function test_RejectsWrongDenom() public {
        IICS26RouterMsgs.Packet memory p = _packet(hubClient, spokeClient, 1, alice, bob, 1 ether);
        IICS20TransferMsgs.FungibleTokenPacketData memory d =
            abi.decode(p.payloads[0].value, (IICS20TransferMsgs.FungibleTokenPacketData));
        d.denom = "usd";
        p.payloads[0].value = abi.encode(d);
        _recv(spoke, p);
        assertEq(bob.balance, 0);
    }

    function test_RejectsForeignSourcePort() public {
        _hubToSpoke(5 ether);
        uint256 bobBefore = bob.balance;

        // spoke: a packet from another port must not mint
        IICS26RouterMsgs.Packet memory p = _packet(hubClient, spokeClient, 2, alice, bob, 1 ether);
        p.payloads[0].sourcePort = Strings.toHexString(alice);
        _recv(spoke, p);
        assertEq(bob.balance, bobBefore);

        // hub: nor release escrow
        address carol = makeAddr("carol");
        p = _packet(spokeClient, hubClient, 1, bob, carol, 1 ether);
        p.payloads[0].sourcePort = Strings.toHexString(bob);
        _recv(hub, p);
        assertEq(carol.balance, 0);
        assertEq(hub.adapter.escrowed(hubClient), 5 ether);
    }

    function test_MissingPrecompileFailsClosed() public {
        vm.etch(NATIVE_PRECOMPILE, "");
        IICS26RouterMsgs.Packet memory p = _packet(hubClient, spokeClient, 1, alice, bob, 1 ether);
        _recv(spoke, p);
        assertEq(bob.balance, 0);
        bytes[] memory acks = new bytes[](1);
        acks[0] = ICS24Host.UNIVERSAL_ERROR_ACK;
        assertEq(_ackCommitment(spoke, p), ICS24Host.packetAcknowledgementCommitmentBytes32(acks));
    }

    function testFuzz_SupplyInvariant(uint96 out, uint96 back) public {
        vm.assume(out > 0 && back > 0 && back <= out);
        vm.deal(alice, uint256(out));
        _hubToSpoke(out);
        vm.prank(bob);
        uint64 seq = spoke.adapter.sendTransfer{ value: back }(spokeClient, Strings.toHexString(alice), timeout, "");
        _recv(hub, _packet(spokeClient, hubClient, seq, bob, alice, back));
        assertEq(bob.balance, hub.adapter.escrowed(hubClient));
        assertEq(address(hub.adapter).balance, hub.adapter.escrowed(hubClient));
    }
}

import { IIBCAppCallbacks } from "@ibc/contracts/msgs/IIBCAppCallbacks.sol";

library IIBCAppCallbacksShim {
    function recv(IICS26RouterMsgs.Packet memory p)
        internal
        pure
        returns (IIBCAppCallbacks.OnRecvPacketCallback memory)
    {
        return
            IIBCAppCallbacks.OnRecvPacketCallback(p.sourceClient, p.destClient, p.sequence, p.payloads[0], address(0));
    }
}
