import { type AbiFunction, type AbiParameter, type Address, type Hex, encodeFunctionData, getAddress, isAddress, isHex, parseUnits, size } from 'viem'

import { canonicalFunctionSignature } from './abiValidation'

type PreparedCall = {
  address: Address
  abi: readonly [AbiFunction]
  functionName: string
  args: readonly unknown[]
  value?: bigint
  signature: string
  calldata: Hex
  displayArgs: readonly unknown[]
}

function parseJson(raw: string): unknown {
  try { return JSON.parse(raw) } catch { throw new Error('Value must be valid JSON') }
}
function parseInteger(type: string, value: unknown): bigint {
  if (typeof value !== 'string') throw new Error(`${type} must be a base-10 decimal string`)
  if (!/^-?\d+$/.test(value)) throw new Error(`${type} must be a decimal integer`)
  const signed = type.startsWith('int')
  const width = Number(type.replace(/^u?int/, '') || 256)
  const parsed = BigInt(value)
  const min = signed ? -(1n << BigInt(width - 1)) : 0n
  const max = signed ? (1n << BigInt(width - 1)) - 1n : (1n << BigInt(width)) - 1n
  if (parsed < min || parsed > max) throw new Error(`${type} value is out of range`)
  return parsed
}
function parseNode(parameter: AbiParameter, value: unknown): unknown {
  const array = /^(.*)\[(\d*)\]$/.exec(parameter.type)
  if (array) {
    if (!Array.isArray(value)) throw new Error(`${parameter.type} must be an array`)
    const expected = array[2] === '' ? undefined : Number(array[2])
    if (expected !== undefined && value.length !== expected) throw new Error(`${parameter.type} must contain exactly ${expected} values`)
    return value.map((entry) => parseNode({ ...parameter, type: array[1] } as AbiParameter, entry))
  }
  const type = parameter.type
  if (type === 'tuple') {
    const components = (parameter as AbiParameter & { components?: readonly AbiParameter[] }).components ?? []
    if (Array.isArray(value)) {
      if (value.length !== components.length) throw new Error(`tuple must contain exactly ${components.length} values`)
      return components.map((component, index) => parseNode(component, value[index]))
    }
    if (value === null || typeof value !== 'object') throw new Error('tuple must be an array or object')
    return components.map((component, index) => {
      const name = component.name || String(index)
      if (!(name in value)) throw new Error(`tuple member ${name} is required`)
      return parseNode(component, (value as Record<string, unknown>)[name])
    })
  }
  if (/^u?int(?:\d+)?$/.test(type)) return parseInteger(type, value)
  if (type === 'bool') {
    if (typeof value !== 'boolean') throw new Error('bool must be true or false')
    return value
  }
  if (type === 'address') {
    if (typeof value !== 'string' || !isAddress(value)) throw new Error('Value must be a valid address')
    return getAddress(value)
  }
  if (/^bytes(?:\d+)?$/.test(type)) {
    if (typeof value !== 'string' || !isHex(value, { strict: true })) throw new Error(`${type} must be a 0x-prefixed byte string`)
    const fixed = Number(type.slice(5))
    if (fixed && size(value) !== fixed) throw new Error(`${type} must contain exactly ${fixed} bytes`)
    return value
  }
  if (type === 'string') {
    if (typeof value !== 'string') throw new Error('string value is required')
    return value
  }
  if (type === 'function') {
    if (typeof value !== 'string' || !isHex(value, { strict: true }) || size(value) !== 24) throw new Error('function must contain exactly 24 bytes')
    return value
  }
  throw new Error(`Unsupported ABI type: ${type}`)
}

export function parseAbiValue(parameter: AbiParameter, raw: string): unknown {
  const composite = parameter.type === 'tuple' || parameter.type.endsWith(']')
  const value = parameter.type === 'bool'
    ? raw.trim() === 'true' ? true : raw.trim() === 'false' ? false : raw.trim()
    : composite ? parseJson(raw) : raw.trim()
  return parseNode(parameter, value)
}
export function parsePayableValue(raw: string, payable: boolean, decimals: number): bigint | undefined {
  const value = raw.trim()
  if (!value) return payable ? 0n : undefined
  if (!payable) throw new Error('Native value is not allowed because this function is not payable')
  try { return parseUnits(value, decimals) } catch { throw new Error('Native value must be a valid non-negative decimal amount') }
}
function display(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map(display)
  return value
}
export function prepareContractCall(addressInput: string, fn: AbiFunction, rawArgs: readonly string[], nativeValue = '', nativeDecimals = 18): PreparedCall {
  const address = getAddress(addressInput)
  const args = fn.inputs.map((input, index) => parseAbiValue(input, rawArgs[index] ?? ''))
  const value = parsePayableValue(nativeValue, fn.stateMutability === 'payable', nativeDecimals)
  const abi = [fn] as const
  const calldata = encodeFunctionData({ abi, functionName: fn.name, args } as never)
  return { address, abi, functionName: fn.name, args, ...(value === undefined ? {} : { value }), signature: canonicalFunctionSignature(fn), calldata, displayArgs: args.map(display) }
}
