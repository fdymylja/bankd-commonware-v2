import { parseAbi, type Address } from 'viem'

export const AUTHORITY_ADDRESS =
  '0x0000000000000000000000000000000041555448' as const
export const NATIVE_ADDRESS =
  '0x0000000000000000000000000000004552433230' as const
export const COMPLIANCE_ADDRESS =
  '0x000000000000000000000000000000434d504c59' as const
export const BANK_SEND_ADDRESS =
  '0x00000000000000000000000042414e4b53454e44' as const
export const SHIELD_ADDRESS =
  '0x0000000000000000000000000000000053484c44' as const
export const VALIDATOR_ADDRESS =
  '0xcccccccc00000000000000000000000000000001' as const
export const IBC_ROUTER_ADDRESS =
  '0x4be2f106a550b243b60fa279228f4e94b1ef8aec' as const
export const IBC_ADAPTER_ADDRESS =
  '0xba01319fa1739a1d69abae52b64105c74764ca4c' as const

export const AUTHORITY_ABI = parseAbi([
  'function owner() view returns (address)',
  'function pendingOwner() view returns (address)',
  'function transferOwnership(address newOwner)',
  'function acceptOwnership()',
  'function cancelTransferOwnership()',
])
export const NATIVE_ABI = parseAbi([
  'function mint(address to, uint256 value) returns (bool)',
  'function burn(address from, uint256 value) returns (bool)',
  'function setMinter(address minter, bool allowed)',
  'function isMinter(address account) view returns (bool)',
  'function registerBank(string bankId, address bridge)',
  'function getBankByBridge(address bridge) view returns (string)',
  'event NativeMint(address indexed caller, address to, uint256 value)',
  'event NativeBurn(address indexed caller, address from, uint256 value)',
  'event NativeSetMinter(address indexed caller, address minter, bool allowed)',
  'event NativeRegisterBank(address indexed caller, string bankId, address bridge)',
])
export const COMPLIANCE_ABI = parseAbi([
  'function freeze(address account)',
  'function unfreeze(address account)',
  'function addSanctioned(address account)',
  'function removeSanctioned(address account)',
  'function seize(address from, address to, uint256 amount)',
  'function isFrozen(address account) view returns (bool)',
  'function isSanctioned(address account) view returns (bool)',
  'function isBlocked(address account) view returns (bool)',
  'event ComplianceFreeze(address indexed caller, address account)',
  'event ComplianceUnfreeze(address indexed caller, address account)',
  'event ComplianceAddSanctioned(address indexed caller, address account)',
  'event ComplianceRemoveSanctioned(address indexed caller, address account)',
  'event ComplianceSeize(address indexed caller, address from, address to, uint256 amount)',
])
export const BANK_SEND_ABI = parseAbi([
  'function send(address recipient, uint256 amount) returns (bool)',
  'function batchSend((address recipient, uint256 amount)[] payments) returns (bool)',
])
export const SHIELD_ABI = parseAbi([
  'function deposit(string recipient) payable returns (bool)',
  'function getLastCommitment() view returns (bytes32 root, uint64 height)',
])
export const VALIDATOR_ABI = parseAbi([
  'struct Validator { bytes32 publicKey; address validatorAddress; string ingress; string egress; address feeRecipient; uint64 index; uint64 addedAtHeight; uint64 deactivatedAtHeight; }',
  'function owner() view returns (address)',
  'function getActiveValidators() view returns (Validator[])',
  'function addValidator(address validatorAddress, bytes32 publicKey, string ingress, string egress, address feeRecipient, bytes signature) returns (uint64)',
  'function deactivateValidator(uint64 idx)',
  'function setIpAddresses(uint64 idx, string ingress, string egress)',
])
export const IBC_ADAPTER_ABI = parseAbi([
  'function sendTransfer(string clientId, string receiver, uint64 timeoutTimestamp, string memo) payable returns (uint64 sequence)',
  'function escrowed(string clientId) view returns (uint256)',
  'event TransferSent(string clientId, uint64 sequence, address indexed sender, string receiver, uint256 amount)',
  'event TransferReceived(string clientId, uint64 sequence, address indexed receiver, uint256 amount)',
  'event TransferRefunded(string clientId, uint64 sequence, address indexed sender, uint256 amount)',
])
export type BankdValidator = {
  publicKey: `0x${string}`
  validatorAddress: Address
  ingress: string
  egress: string
  feeRecipient: Address
  index: bigint
  addedAtHeight: bigint
  deactivatedAtHeight: bigint
}

export const IBC_ROUTER_ABI = parseAbi([
  'struct CounterpartyInfo { string clientId; bytes[] merklePrefix; }',
  'struct Payload { string sourcePort; string destPort; string version; string encoding; bytes value; }',
  'struct Packet { uint64 sequence; string sourceClient; string destClient; uint64 timeoutTimestamp; Payload[] payloads; }',
  'event ICS02ClientAdded(string clientId, CounterpartyInfo counterpartyInfo, address client)',
  'event ICS02ClientMigrated(string clientId, CounterpartyInfo counterpartyInfo, address client)',
  'event SendPacket(string indexed clientId, uint256 indexed sequence, Packet packet)',
  'event WriteAcknowledgement(string indexed clientId, uint256 indexed sequence, Packet packet, bytes[] acknowledgements)',
  'event AckPacket(string indexed clientId, uint256 indexed sequence, Packet packet, bytes acknowledgement)',
  'function getClient(string clientId) view returns (address)',
  'function getCounterparty(string clientId) view returns (CounterpartyInfo)',
  'function getCommitment(bytes32 hashedPath) view returns (bytes32)',
])
export const IBC_LIGHT_CLIENT_ABI = parseAbi([
  'function getClientState() view returns (bytes)',
])
