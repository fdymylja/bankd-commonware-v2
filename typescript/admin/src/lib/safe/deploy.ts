// src/lib/safe/deploy.ts
/**
 * CREATE2 deploy helpers. Deploying through CreateCall.performCreate2 with a
 * chosen salt makes the contract address deterministic *before* the tx runs, so
 * a Safe can batch [deploy, register(address)] into one atomic MultiSend
 * proposal - the register step references the predicted address. Works the same
 * on the personal signer (two sequential txs at the same predicted address).
 *
 * The CREATE2 deployer is the CreateCall library itself (a Safe / MultiSend
 * plain-CALLs it, so `address(this)` inside performCreate2 is CreateCall), which
 * is what `from` must be for the address to match.
 */

import {
  type Abi,
  type Hex,
  encodeDeployData,
  getContractAddress,
  toHex,
} from 'viem'

import { CREATE_CALL_ADDRESS } from './abi'

/** Full CREATE2 init code: contract bytecode + ABI-encoded constructor args. */
export function encodeInitCode(input: {
  abi: Abi | readonly unknown[]
  bytecode: Hex
  args?: readonly unknown[]
}): Hex {
  return encodeDeployData({
    abi: input.abi as Abi,
    bytecode: input.bytecode,
    args: (input.args ?? []) as readonly unknown[],
  })
}

/** A random 32-byte salt, so repeat deploys of the same code don't collide. */
export function randomSalt(): Hex {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/** The address `CreateCall.performCreate2(_, initCode, salt)` will deploy to. */
export function predictCreate2Address(initCode: Hex, salt: Hex): Hex {
  return getContractAddress({
    opcode: 'CREATE2',
    from: CREATE_CALL_ADDRESS,
    salt,
    bytecode: initCode,
  })
}
