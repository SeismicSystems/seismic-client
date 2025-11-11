import type { Abi } from 'abitype'
import depositContractAbiJson from '@sviem/abis/depositContract.json' with { type: 'json' }

export const depositContractAbi = depositContractAbiJson.abi as Abi

export interface DepositContractConfig {
  address: `0x${string}`
  abi: Abi
}

export const defaultDepositContract: DepositContractConfig = {
  address: '0x00000000219ab540356cBB839Cbe05303d7705Fa' as `0x${string}`,
  abi: depositContractAbi,
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