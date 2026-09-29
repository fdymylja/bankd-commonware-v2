// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { Strings } from "@openzeppelin-contracts/utils/Strings.sol";
import { ERC1967Proxy } from "@openzeppelin-contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { AccessManager } from "@openzeppelin-contracts/access/manager/AccessManager.sol";

import { ICS26Router } from "@ibc/contracts/ICS26Router.sol";
import { IICS26Router } from "@ibc/contracts/interfaces/IICS26Router.sol";
import { IICS02ClientMsgs } from "@ibc/contracts/msgs/IICS02ClientMsgs.sol";
import { ILightClientMsgs } from "@ibc/contracts/msgs/ILightClientMsgs.sol";
import { IICS26RouterMsgs } from "@ibc/contracts/msgs/IICS26RouterMsgs.sol";
import { IICS20TransferMsgs } from "@ibc/contracts/msgs/IICS20TransferMsgs.sol";
import { ICS20Lib } from "@ibc/contracts/utils/ICS20Lib.sol";
import { ICS24Host } from "@ibc/contracts/utils/ICS24Host.sol";
import { DummyLightClient } from "@ibc/test/solidity-ibc/mocks/DummyLightClient.sol";

import { ICS20NativeAdapter } from "../src/ics20/ICS20NativeAdapter.sol";

/// @notice Deploys a hub IBC stack and sends 5 BRL to a spoke receiver. Used by
/// relayer/scripts/gen-e2e-fixture.sh to get a real packet commitment into real chain state.
/// The hub-side client for the spoke is a dummy since only hub -> spoke is proven here.
contract HubSend is Script {
    function run() external {
        address receiver = vm.envAddress("RECEIVER");
        string memory out = vm.envString("OUT");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address me = vm.addr(pk);
        vm.startBroadcast(pk);
        AccessManager am = new AccessManager(me);
        ICS26Router router = ICS26Router(
            address(new ERC1967Proxy(address(new ICS26Router()), abi.encodeCall(ICS26Router.initialize, (address(am)))))
        );
        ICS20NativeAdapter adapter =
            new ICS20NativeAdapter(IICS26Router(address(router)), ICS20NativeAdapter.Mode.Hub, me);
        router.addIBCApp(ICS20Lib.DEFAULT_PORT_ID, address(adapter));

        bytes[] memory prefix = new bytes[](1);
        prefix[0] = "";
        string memory clientId = router.addClient(
            IICS02ClientMsgs.CounterpartyInfo("client-0", prefix),
            address(new DummyLightClient(ILightClientMsgs.UpdateResult.Update, 0, false))
        );

        uint64 timeout = uint64(block.timestamp + 1 days);
        uint64 seq = adapter.sendTransfer{ value: 5 ether }(clientId, Strings.toHexString(receiver), timeout, "");
        vm.stopBroadcast();

        IICS26RouterMsgs.Packet memory p;
        p.sequence = seq;
        p.sourceClient = clientId;
        p.destClient = "client-0";
        p.timeoutTimestamp = timeout;
        p.payloads = new IICS26RouterMsgs.Payload[](1);
        p.payloads[0] = IICS26RouterMsgs.Payload({
            sourcePort: ICS20Lib.DEFAULT_PORT_ID,
            destPort: ICS20Lib.DEFAULT_PORT_ID,
            version: ICS20Lib.ICS20_VERSION,
            encoding: ICS20Lib.ICS20_ENCODING,
            value: abi.encode(
                IICS20TransferMsgs.FungibleTokenPacketData({
                    denom: "ujuno",
                    sender: Strings.toHexString(me),
                    receiver: Strings.toHexString(receiver),
                    amount: 5 ether / 1e12,
                    memo: ""
                })
            )
        });
        bytes memory path = ICS24Host.packetCommitmentPathCalldata(clientId, seq);
        // Sanity: the packet we rebuilt is the one the router committed.
        require(router.getCommitment(keccak256(path)) == ICS24Host.packetCommitmentBytes32(p), "commitment mismatch");

        string memory o = "hub";
        vm.serializeAddress(o, "router", address(router));
        vm.serializeBytes(o, "packet", abi.encode(p));
        vm.serializeBytes(o, "commitmentPath", path);
        string memory json = vm.serializeBytes32(o, "slot", keccak256(abi.encode(keccak256(path), _ibcStoreSlot())));
        vm.writeJson(json, out);
    }

    function _ibcStoreSlot() private pure returns (bytes32) {
        return 0x1260944489272988d9df285149b5aa1b0f48f2136d6f416159f840a3e0747600;
    }
}
