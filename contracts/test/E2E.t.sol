// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";

import { IICS26RouterMsgs } from "@ibc/contracts/msgs/IICS26RouterMsgs.sol";
import { IICS02ClientMsgs } from "@ibc/contracts/msgs/IICS02ClientMsgs.sol";
import { LibBLS12381 as BLS } from "@commonware/certificate/LibBLS12381.sol";

import { CommonwareLightClient } from "../src/light-client/CommonwareLightClient.sol";
import { ICS20NativeAdapter } from "../src/ics20/ICS20NativeAdapter.sol";
import { NATIVE_PRECOMPILE } from "../src/ics20/INative.sol";
import { MockNative } from "./utils/MockNative.sol";
import { IBCDeployer } from "./utils/IBCDeployer.sol";

/// @dev One BRL packet hub -> spoke with nothing mocked on the proof path. The hub ran on anvil
/// (script/HubSend.s.sol), the packet commitment proof is its eth_getProof, and the header carrying
/// that state root is certified by a commonware threshold key. See relayer/scripts/gen-e2e-fixture.sh.
contract E2ETest is Test {
    using IBCDeployer for IBCDeployer.Chain;

    string internal json;
    IBCDeployer.Chain internal spoke;
    CommonwareLightClient internal lc;
    string internal clientId;

    function setUp() public {
        json = vm.readFile(string.concat(vm.projectRoot(), "/test/fixtures/e2e.json"));
        vm.etch(NATIVE_PRECOMPILE, address(new MockNative()).code);

        spoke = IBCDeployer.deploy(ICS20NativeAdapter.Mode.Spoke, address(this));
        lc = new CommonwareLightClient(
            vm.parseJsonAddress(json, ".router"),
            vm.parseJsonBytes(json, ".namespace"),
            uint64(vm.parseJsonUint(json, ".epochLength")),
            0,
            abi.decode(vm.parseJsonBytes(json, ".epoch0Key"), (BLS.G2Point))
        );
        // The hub's client for this spoke is also client-0 (first client on the hub router).
        clientId = spoke.addClient("client-0", address(lc));
        spoke.adapter.setTrustedClient(clientId, true);
    }

    function test_HubToSpoke_ProvenPacketMintsNative() public {
        // Relayer step 1: updateClient with the certified header.
        CommonwareLightClient.MsgUpdateClient memory m;
        m.headerRlp = vm.parseJsonBytes(json, ".update.headerRlp");
        m.viewNumber = uint64(vm.parseJsonUint(json, ".update.view"));
        m.parentView = uint64(vm.parseJsonUint(json, ".update.parentView"));
        m.signature = vm.parseJsonBytes(json, ".update.voteSignature");
        spoke.router.updateClient(clientId, abi.encode(m));

        // Relayer step 2: recvPacket with the eth_getProof storage proof.
        IICS26RouterMsgs.Packet memory p = abi.decode(vm.parseJsonBytes(json, ".packet"), (IICS26RouterMsgs.Packet));
        uint64 height = uint64(vm.parseJsonUint(json, ".update.height"));
        bytes memory proof = abi.encode(
            CommonwareLightClient.MembershipProof({
                accountProof: vm.parseJsonBytesArray(json, ".accountProof"),
                storageProof: vm.parseJsonBytesArray(json, ".storageProof")
            })
        );
        // Stay inside the packet timeout, which anvil set relative to its own clock.
        vm.warp(vm.parseJsonUint(json, ".update.timestamp") + 60);

        address receiver = vm.parseJsonAddress(json, ".receiver");
        assertEq(receiver.balance, 0);
        spoke.router.recvPacket(IICS26RouterMsgs.MsgRecvPacket(p, proof, IICS02ClientMsgs.Height(0, height)));
        assertEq(receiver.balance, 5 ether, "native BRL minted on spoke");

        // Replaying the same packet is a no-op, no double mint.
        spoke.router.recvPacket(IICS26RouterMsgs.MsgRecvPacket(p, proof, IICS02ClientMsgs.Height(0, height)));
        assertEq(receiver.balance, 5 ether);
    }

    function test_RevertWhen_PacketTampered() public {
        CommonwareLightClient.MsgUpdateClient memory m;
        m.headerRlp = vm.parseJsonBytes(json, ".update.headerRlp");
        m.viewNumber = uint64(vm.parseJsonUint(json, ".update.view"));
        m.parentView = uint64(vm.parseJsonUint(json, ".update.parentView"));
        m.signature = vm.parseJsonBytes(json, ".update.voteSignature");
        spoke.router.updateClient(clientId, abi.encode(m));

        IICS26RouterMsgs.Packet memory p = abi.decode(vm.parseJsonBytes(json, ".packet"), (IICS26RouterMsgs.Packet));
        p.timeoutTimestamp += 1; // changes the commitment
        bytes memory proof = abi.encode(
            CommonwareLightClient.MembershipProof({
                accountProof: vm.parseJsonBytesArray(json, ".accountProof"),
                storageProof: vm.parseJsonBytesArray(json, ".storageProof")
            })
        );
        vm.warp(vm.parseJsonUint(json, ".update.timestamp") + 60);
        uint64 height = uint64(vm.parseJsonUint(json, ".update.height"));
        vm.expectRevert();
        spoke.router.recvPacket(IICS26RouterMsgs.MsgRecvPacket(p, proof, IICS02ClientMsgs.Height(0, height)));
    }
}
