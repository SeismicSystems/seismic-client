import type { Abi, Address } from 'viem'

export const DIRECTORY_ADDRESS =
  '0x1000000000000000000000000000000000000004' as Address

export const DirectoryAbi = [
  {
    inputs: [{ name: '_addr', type: 'address' }],
    name: 'checkHasKey',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'to', type: 'address' }],
    name: 'keyHash',
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getKey',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_key', type: 'suint256' }],
    name: 'setKey',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const satisfies Abi
