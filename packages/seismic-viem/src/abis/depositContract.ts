import type { Abi } from 'abitype'

export const depositContractAbi = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'nodePubkey', type: 'bytes', internalType: 'bytes' },
      { name: 'consensusPubkey', type: 'bytes', internalType: 'bytes' },
      { name: 'withdrawalCredentials', type: 'bytes', internalType: 'bytes' },
      { name: 'nodeSignature', type: 'bytes', internalType: 'bytes' },
      { name: 'consensusSignature', type: 'bytes', internalType: 'bytes' },
      { name: 'depositDataRoot', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'get_deposit_root',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'get_deposit_count',
    inputs: [],
    outputs: [{ name: '', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'view',
  },
] as const satisfies Abi

export interface DepositContractConfig {
  address: `0x${string}`
  abi: Abi
}

export const defaultDepositContract: DepositContractConfig = {
  address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' as `0x${string}`,
  abi: depositContractAbi as Abi,
}

let customDepositContract: DepositContractConfig | null = null

export function setDepositContract(config: DepositContractConfig) {
  customDepositContract = config
}

export function getDepositContract(): DepositContractConfig {
  return customDepositContract || defaultDepositContract
}

export function resetDepositContract() {
  customDepositContract = null
}

