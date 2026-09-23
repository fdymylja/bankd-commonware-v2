// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.28;

import { ERC1967Proxy } from "@openzeppelin-contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { AccessManager } from "@openzeppelin-contracts/access/manager/AccessManager.sol";

import { ICS26Router } from "@ibc/contracts/ICS26Router.sol";
import { IICS26Router } from "@ibc/contracts/interfaces/IICS26Router.sol";
import { IICS02ClientMsgs } from "@ibc/contracts/msgs/IICS02ClientMsgs.sol";
import { ICS20Lib } from "@ibc/contracts/utils/ICS20Lib.sol";

import { ICS20NativeAdapter } from "../../src/ics20/ICS20NativeAdapter.sol";

/// @dev Deploys one chain's IBC stack. The caller is the AccessManager admin, so it can relay and
/// customize ids without extra role wiring.
library IBCDeployer {
    struct Chain {
        ICS26Router router;
        ICS20NativeAdapter adapter;
    }

    function deploy(ICS20NativeAdapter.Mode mode, address owner) internal returns (Chain memory c) {
        AccessManager am = new AccessManager(address(this));
        ICS26Router logic = new ICS26Router();
        c.router = ICS26Router(
            address(new ERC1967Proxy(address(logic), abi.encodeCall(ICS26Router.initialize, (address(am)))))
        );
        c.adapter = new ICS20NativeAdapter(IICS26Router(address(c.router)), mode, owner);
        c.router.addIBCApp(ICS20Lib.DEFAULT_PORT_ID, address(c.adapter));
    }

    /// @dev Empty merkle prefix, so the light client sees the raw ICS24 path as path[0].
    function addClient(Chain memory c, string memory counterpartyId, address lc) internal returns (string memory) {
        bytes[] memory prefix = new bytes[](1);
        prefix[0] = "";
        return c.router.addClient(IICS02ClientMsgs.CounterpartyInfo(counterpartyId, prefix), lc);
    }
}
