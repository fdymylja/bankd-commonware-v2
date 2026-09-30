// src/lib/safe/abi.ts
/**
 * Minimal Safe (Gnosis Safe / SafeL2) ABI fragments plus the msgexec precompile
 * bits we drive from the EVM Safe surface. Only the methods this UI actually
 * calls are here - full Safe ABI isn't needed.
 *
 * The msgexec precompile lets a Safe run Cosmos SDK messages: `execute(typeUrl,
 * protoBytes)` where `contract.Caller()` is the Safe address (== the cosmos
 * multisig address), so cosmos-side signer checks pass. See x/msgexec.
 */

export {
  MSGEXEC_ABI,
  MSGEXEC_PRECOMPILE_ADDRESS,
} from '@bankd/shared/evm/precompile'

/** The zero address - Safe uses it for gasToken / refundReceiver (no refund). */
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

/**
 * MultiSendCallOnly 1.4.1 - preinstalled in genesis (see dev-genesis.json /
 * x/safe/types/contracts.go). A Safe delegatecalls it (operation=1) to run
 * several plain CALLs atomically in one execTransaction, so a multi-step feature
 * (e.g. ERC20 approve + call) is a single Safe proposal. "CallOnly" = it rejects
 * delegatecall sub-ops, which is all we need (every sub-call is a plain CALL).
 */
export const MULTISEND_CALL_ONLY_ADDRESS =
  '0x9641d764fc13c8B624c04430C7356C1C7C8102e2' as const

/**
 * CreateCall 1.4.1 - preinstalled in genesis. A Safe CALLs performCreate() to
 * deploy a contract from its own address; the deployed address comes back in the
 * ContractCreation event on the execTransaction receipt.
 */
export const CREATE_CALL_ADDRESS =
  '0x9b35Af71d77eaf8d7e40252370304687390A1A52' as const

/** MultiSendCallOnly ABI fragment - just `multiSend(bytes)`. */
export const MULTISEND_ABI = [
  {
    type: 'function',
    name: 'multiSend',
    stateMutability: 'payable',
    inputs: [{ name: 'transactions', type: 'bytes' }],
    outputs: [],
  },
] as const

/**
 * CreateCall ABI - `performCreate` (plain CREATE) and the ContractCreation event
 * we parse off the receipt to learn the deployed address.
 */
export const CREATE_CALL_ABI = [
  {
    type: 'function',
    name: 'performCreate',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'value', type: 'uint256' },
      { name: 'deploymentData', type: 'bytes' },
    ],
    outputs: [{ name: 'newContract', type: 'address' }],
  },
  {
    // CREATE2 so the deployed address is known before execution - lets a Safe
    // batch [deploy, register(address)] atomically in one proposal.
    type: 'function',
    name: 'performCreate2',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'value', type: 'uint256' },
      { name: 'deploymentData', type: 'bytes' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [{ name: 'newContract', type: 'address' }],
  },
  {
    type: 'event',
    name: 'ContractCreation',
    inputs: [{ name: 'newContract', type: 'address', indexed: false }],
  },
] as const

/**
 * Authority-module MsgExec typeUrl. Wrapping an inner SDK msg in this and
 * running it via `msgexec.execute` lets the Safe drive x/authority: the outer
 * MsgExec.sender is the Safe (owner), the inner msg is executed as the authority
 * module account.
 */
export const AUTHORITY_MSGEXEC_TYPE = '/mizufinance.authority.v1.MsgExec'

/**
 * The x/authority module account address (bech32). Derived as
 * `authtypes.NewModuleAddress("authority")` = bech32(prefix, sha256("authority")[:20]).
 * Inner msgs executed through authority exec must carry this as their signer.
 */
export const AUTHORITY_MODULE_ADDRESS =
  'wallet13am065qmk680w86wya4u9refhnssqwcvd98446'

/** Safe ABI fragments this surface uses (viem-typed). */
export const SAFE_ABI = [
  {
    type: 'function',
    name: 'execTransaction',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getTransactionHash',
    stateMutability: 'view',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: '_nonce', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'nonce',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'addOwnerWithThreshold',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: '_threshold', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeOwner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'prevOwner', type: 'address' },
      { name: 'owner', type: 'address' },
      { name: '_threshold', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'changeThreshold',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_threshold', type: 'uint256' }],
    outputs: [],
  },
] as const
