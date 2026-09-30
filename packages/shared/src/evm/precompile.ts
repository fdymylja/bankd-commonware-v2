// MsgExec precompile address (hex encoded 'MSGE')
export const MSGEXEC_PRECOMPILE_ADDRESS = '0x000000000000000000000000004D534745584543'

export const MSGEXEC_ABI = [
  {
    name: 'execute',
    inputs: [
      {
        name: 'typeUrl',
        type: 'string',
      },
      {
        name: 'value',
        type: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'result',
        type: 'bytes',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    name: 'executeBatch',
    inputs: [
      {
        name: 'typeUrls',
        type: 'string[]',
      },
      {
        name: 'values',
        type: 'bytes[]',
      },
    ],
    outputs: [
      {
        name: 'results',
        type: 'bytes[]',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// Native precompile address (hex encoded 'ERC20')
export const NATIVE_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000004552433230'

export { NATIVE_ABI } from './bankd'
