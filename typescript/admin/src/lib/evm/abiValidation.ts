import { type Abi, type AbiFunction, toFunctionSignature } from 'viem'

const ITEM_TYPES = new Set(['function', 'constructor', 'event', 'error', 'fallback', 'receive'])
const MUTABILITIES = new Set(['pure', 'view', 'nonpayable', 'payable'])
const ARRAY_SUFFIX = /(?:\[(?:0|[1-9]\d*)?\])*$/

function object(value: unknown, context: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context} must be an object`)
  }
  return value as Record<string, unknown>
}

function validBaseType(type: string): boolean {
  if (['address', 'bool', 'string', 'bytes', 'function', 'tuple'].includes(type)) return true
  if (/^bytes(?:[1-9]|[12]\d|3[0-2])$/.test(type)) return true
  const integer = /^(u?int)(\d*)$/.exec(type)
  if (!integer) return false
  if (!integer[2]) return true
  const width = Number(integer[2])
  return width >= 8 && width <= 256 && width % 8 === 0
}

function parameter(value: unknown, context: string, event = false): Record<string, unknown> {
  const input = object(value, context)
  if (typeof input.type !== 'string') throw new Error(`${context}.type must be a Solidity type`)
  const suffix = input.type.match(ARRAY_SUFFIX)?.[0] ?? ''
  if (/\[0\]/.test(suffix)) throw new Error(`${context}.type fixed array length must be greater than zero`)
  const base = input.type.slice(0, input.type.length - suffix.length)
  if (!validBaseType(base)) throw new Error(`${context}.type is not a valid Solidity type`)
  const result: Record<string, unknown> = { type: input.type }
  if (input.name !== undefined) {
    if (typeof input.name !== 'string') throw new Error(`${context}.name must be a string`)
    result.name = input.name
  }
  if (event && input.indexed !== undefined) {
    if (typeof input.indexed !== 'boolean') throw new Error(`${context}.indexed must be boolean`)
    result.indexed = input.indexed
  }
  if (base === 'tuple') {
    if (!Array.isArray(input.components)) throw new Error(`${context}.components is required for tuple types`)
    result.components = input.components.map((component, index) => parameter(component, `${context}.components[${index}]`))
  } else if (input.components !== undefined) {
    throw new Error(`${context}.components is only valid for tuple types`)
  }
  return result
}

function parameters(value: unknown, context: string, event = false): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`)
  return value.map((entry, index) => parameter(entry, `${context}[${index}]`, event))
}

function item(value: unknown, index: number): Record<string, unknown> {
  const context = `ABI item ${index}`
  const input = object(value, context)
  if (typeof input.type !== 'string' || !ITEM_TYPES.has(input.type)) throw new Error(`${context}.type is unsupported`)
  const result: Record<string, unknown> = { type: input.type }
  if (['function', 'event', 'error'].includes(input.type)) {
    if (typeof input.name !== 'string' || input.name.length === 0) throw new Error(`${context}.name is required`)
    result.name = input.name
  }
  if (['function', 'constructor', 'event', 'error'].includes(input.type)) {
    result.inputs = parameters(input.inputs ?? [], `${context}.inputs`, input.type === 'event')
  }
  if (input.type === 'function') result.outputs = parameters(input.outputs ?? [], `${context}.outputs`)
  if (['function', 'constructor', 'fallback', 'receive'].includes(input.type)) {
    const defaultMutability = input.type === 'receive' ? 'payable' : 'nonpayable'
    const mutability = input.stateMutability ?? defaultMutability
    if (typeof mutability !== 'string' || !MUTABILITIES.has(mutability)) throw new Error(`${context}.stateMutability is invalid`)
    if (input.type === 'receive' && mutability !== 'payable') throw new Error(`${context}.stateMutability must be payable`)
    result.stateMutability = mutability
  }
  if (input.type === 'event') {
    if (input.anonymous !== undefined && typeof input.anonymous !== 'boolean') throw new Error(`${context}.anonymous must be boolean`)
    result.anonymous = input.anonymous ?? false
  }
  return result
}

export function parseUntrustedAbi(jsonOrValue: string | unknown): Abi {
  let parsed: unknown = jsonOrValue
  if (typeof jsonOrValue === 'string') {
    try { parsed = JSON.parse(jsonOrValue) } catch { throw new Error('ABI is not valid JSON') }
  }
  if (!Array.isArray(parsed)) {
    const artifact = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>).abi : undefined
    parsed = artifact
  }
  if (!Array.isArray(parsed)) throw new Error('ABI must be an ABI array or artifact containing an ABI array')
  return parsed.map(item) as unknown as Abi
}

export function canonicalFunctionSignature(fn: Abi[number]): string {
  if (fn.type !== 'function') throw new Error('ABI item is not a function')
  return toFunctionSignature(fn as AbiFunction)
}
