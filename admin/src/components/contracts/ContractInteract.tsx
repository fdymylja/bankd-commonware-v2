'use client'

import { estimateGas, getAccount, readContract, simulateContract, waitForTransactionReceipt, writeContract } from '@wagmi/core'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { type Abi, type AbiFunction, type Hex, formatUnits } from 'viem'

import { Button } from '@/components/ui'
import { chainDefinition } from '@/lib/config'
import { canonicalFunctionSignature } from '@/lib/evm/abiValidation'
import { parseAbiValue, prepareContractCall } from '@/lib/evm/contractCall'
import { type WriteOperations, type WriteReview, confirmReviewedWrite, createWriteReview } from '@/lib/evm/reviewedContractWrite'
import { makeWagmiConfig } from '@/lib/evm/wagmi'
import { getErrorMessage } from '@/lib/utils'

const isReadFn = (fn: AbiFunction) => fn.stateMutability === 'view' || fn.stateMutability === 'pure'
const stringify = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2) ?? 'No return value'

function wagmiOperations(): WriteOperations {
  const config = makeWagmiConfig()
  return {
    getAccount: () => getAccount(config),
    estimateGas: (request) => estimateGas(config, request as never),
    simulate: (request) => simulateContract(config, request as never) as never,
    write: (request) => writeContract(config, request as never),
    wait: (hash) => waitForTransactionReceipt(config, { hash }),
  }
}

function FunctionCard({ address, fn, writeEnabled }: { address: Hex; fn: AbiFunction; writeEnabled: boolean }) {
  const [args, setArgs] = useState(() => fn.inputs.map(() => ''))
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<(string | null)[]>(fn.inputs.map(() => null))
  const [review, setReview] = useState<WriteReview | null>(null)
  const read = isReadFn(fn)
  const signature = canonicalFunctionSignature(fn)

  const validate = () => {
    const errors = fn.inputs.map((input, index) => {
      try { parseAbiValue(input, args[index] ?? ''); return null } catch (cause) { return getErrorMessage(cause, 'Invalid value') }
    })
    setFieldErrors(errors)
    return errors.every((item) => item === null)
  }
  const runRead = async () => {
    if (!validate()) return
    setBusy(true); setError(null); setResult(null)
    try {
      const call = prepareContractCall(address, fn, args)
      const out = await readContract(makeWagmiConfig(), { address: call.address, abi: call.abi, functionName: call.functionName, args: call.args } as never)
      setResult(stringify(out))
    } catch (cause) { setError(getErrorMessage(cause, `${signature} failed`)) } finally { setBusy(false) }
  }
  const beginReview = async () => {
    if (!validate()) return
    setBusy(true); setError(null); setReview(null)
    try {
      setReview(await createWriteReview(wagmiOperations(), { address, fn, rawArgs: args, nativeValue: value, chainId: chainDefinition.id, nativeDecimals: chainDefinition.nativeCurrency.decimals }))
    } catch (cause) { setError(getErrorMessage(cause, `Simulation failed for ${signature}`)) } finally { setBusy(false) }
  }
  const confirm = async () => {
    if (!review) return
    setBusy(true); setError(null)
    const toastId = toast.loading(`Sending ${signature}...`)
    try {
      const outcome = await confirmReviewedWrite(wagmiOperations(), review)
      toast.success(`${signature} confirmed`, { id: toastId })
      setResult(stringify(outcome)); setReview(null)
    } catch (cause) {
      const message = getErrorMessage(cause, `${signature} failed`)
      toast.error(message, { id: toastId }); setError(message)
    } finally { setBusy(false) }
  }

  return <div className="rounded-lg border border-gray-200 p-3">
    <div className="mb-2 flex items-center justify-between"><span className="font-mono text-sm font-medium text-gray-900">{signature}</span><span className={read ? 'rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600' : 'rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700'}>{read ? 'read' : 'write'}</span></div>
    <div className="mb-2 flex flex-col gap-2">{fn.inputs.map((input, index) => <label key={`${signature}:${index}`} className="text-xs"><input className="w-full rounded border border-gray-200 px-2 py-1 font-mono" placeholder={`${input.name || `arg${index}`} (${input.type})`} value={args[index]} onChange={(event) => { const next = [...args]; next[index] = event.target.value; setArgs(next); setReview(null) }} />{fieldErrors[index] && <span className="text-red-600">{fieldErrors[index]}</span>}</label>)}
      {fn.stateMutability === 'payable' && <input className="w-full rounded border border-gray-200 px-2 py-1 font-mono text-xs" placeholder={`${chainDefinition.nativeCurrency.symbol} value`} value={value} onChange={(event) => { setValue(event.target.value); setReview(null) }} />}
    </div>
    <Button size="sm" variant={read ? 'secondary' : 'primary'} isLoading={busy} disabled={!read && !writeEnabled} onClick={read ? runRead : beginReview}>{read ? 'Call' : 'Review'}</Button>
    {review && <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs"><h5 className="font-semibold">Review transaction</h5><dl className="mt-2 grid gap-1 font-mono break-all"><div>Signer: {review.display.account}</div><div>Network: {chainDefinition.name} ({review.display.chainId})</div><div>Target: {review.display.address}</div><div>Function: {review.display.signature}</div><div>Arguments: {stringify(review.display.args)}</div><div>Calldata: {review.display.calldata}</div><div>Native value: {review.display.value.toString()} wei ({formatUnits(review.display.value, chainDefinition.nativeCurrency.decimals)} {chainDefinition.nativeCurrency.symbol})</div><div>Estimated gas: {review.display.gas.toString()}</div></dl><div className="mt-2 flex gap-2"><Button size="sm" variant="secondary" onClick={() => setReview(null)}>Cancel</Button><Button size="sm" isLoading={busy} onClick={confirm}>Confirm and send</Button></div></div>}
    {result !== null && <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-800">{result}</pre>}{error && <p className="mt-2 text-xs text-red-600">{error}</p>}
  </div>
}

export function ContractInteract({ address, abi, writeEnabled = true }: { address: Hex; abi: Abi; writeEnabled?: boolean }) {
  const functions = useMemo(() => abi.filter((item): item is AbiFunction => item.type === 'function'), [abi])
  const reads = functions.filter(isReadFn), writes = functions.filter((fn) => !isReadFn(fn))
  if (!functions.length) return <p className="text-sm text-gray-500">ABI has no callable functions.</p>
  return <div className="grid gap-3 md:grid-cols-2"><div className="flex flex-col gap-2"><h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Read</h4>{reads.length === 0 && <p className="text-xs text-gray-400">none</p>}{reads.map((fn) => <FunctionCard key={canonicalFunctionSignature(fn)} address={address} fn={fn} writeEnabled={writeEnabled} />)}</div><div className="flex flex-col gap-2"><h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Write</h4>{writes.length === 0 && <p className="text-xs text-gray-400">none</p>}{writes.map((fn) => <FunctionCard key={canonicalFunctionSignature(fn)} address={address} fn={fn} writeEnabled={writeEnabled} />)}</div></div>
}
