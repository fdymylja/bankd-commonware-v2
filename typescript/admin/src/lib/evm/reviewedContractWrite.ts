import { type AbiFunction, type Address, type Hex, getAddress } from 'viem'

import { prepareContractCall } from './contractCall'

type Account = { address?: string; chainId?: number }
type Request = Record<string, unknown> & { account: Address; address: Address; chainId: number; gas: bigint }
export type WriteOperations = {
  getAccount(): Promise<Account> | Account
  estimateGas(request: Record<string, unknown>): Promise<bigint>
  simulate(request: Record<string, unknown>): Promise<{ request: Record<string, unknown> }>
  write(request: Request): Promise<Hex>
  wait(hash: Hex): Promise<{ status: string }>
}
export type WriteReview = Readonly<{
  account: Address
  chainId: number
  request: Readonly<Request>
  display: Readonly<{ signature: string; address: Address; account: Address; chainId: number; args: readonly unknown[]; calldata: Hex; value: bigint; gas: bigint }>
}>

export async function createWriteReview(ops: WriteOperations, input: { address: string; fn: AbiFunction; rawArgs: readonly string[]; nativeValue?: string; chainId: number; nativeDecimals?: number }): Promise<WriteReview> {
  const accountState = await ops.getAccount()
  if (!accountState.address) throw new Error('Connect a signer before reviewing this transaction')
  if (accountState.chainId !== input.chainId) throw new Error(`Connected chain ${accountState.chainId ?? 'unknown'} does not match required chain ${input.chainId}`)
  const call = prepareContractCall(input.address, input.fn, input.rawArgs, input.nativeValue, input.nativeDecimals)
  const account = getAddress(accountState.address)
  const base = { account, address: call.address, abi: call.abi, functionName: call.functionName, args: call.args, value: call.value, chainId: input.chainId }
  const gas = await ops.estimateGas(base)
  const simulation = await ops.simulate({ ...base, gas })
  const request = Object.freeze({ ...simulation.request, account, address: call.address, chainId: input.chainId, gas }) as Request
  const display = Object.freeze({ signature: call.signature, address: call.address, account, chainId: input.chainId, args: call.displayArgs, calldata: call.calldata, value: call.value ?? 0n, gas })
  return Object.freeze({ account, chainId: input.chainId, request, display })
}

export async function confirmReviewedWrite(ops: WriteOperations, review: WriteReview): Promise<{ hash: Hex; status: 'success' }> {
  const current = await ops.getAccount()
  if (!current.address || getAddress(current.address) !== review.account || current.chainId !== review.chainId) throw new Error('Signer or chain changed after review; review the transaction again')
  const hash = await ops.write(review.request as Request)
  const receipt = await ops.wait(hash)
  if (receipt.status !== 'success') throw new Error(`Contract transaction reverted: ${hash} calling ${review.display.signature} on ${review.display.address}`)
  return { hash, status: 'success' }
}
