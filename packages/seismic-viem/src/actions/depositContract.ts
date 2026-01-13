import type {
  Account,
  Address,
  Chain,
  Hex,
  PublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  Transport,
  WalletClient,
} from 'viem'
import type { WriteContractReturnType } from 'viem'
import { readContract, writeContract } from 'viem/actions'

import { depositContractAbi } from '@sviem/abis/depositContract.ts'

export const DEPOSIT_CONTRACT_ADDRESS: Address =
  '0x00000000219ab540356cBB839Cbe05303d7705Fa'

export type DepositParameters = {
  /** Deposit contract address */
  address?: Address
  /** Validator public key*/
  nodePubkey: Hex
  /** Consensus public key */
  consensusPubkey: Hex
  /** Withdrawal credentials */
  withdrawalCredentials: Hex
  /** Node signature */
  nodeSignature: Hex
  /** Consensus signature */
  consensusSignature: Hex
  /** Deposit data root */
  depositDataRoot: Hex
  /** Amount of ETH to deposit */
  value: bigint
}

/** Base parameters for deposit contract read operations */
export type DepositContractBaseParameters = {
  /** Deposit contract address */
  address?: Address
}

export type GetDepositRootParameters = DepositContractBaseParameters
export type GetDepositCountParameters = DepositContractBaseParameters

export type DepositContractPublicActions = {
  getDepositRoot: (
    args: GetDepositRootParameters
  ) => Promise<ReadContractReturnType>
  getDepositCount: (
    args: GetDepositCountParameters
  ) => Promise<ReadContractReturnType>
}

export const depositContractPublicActions = <
  TTransport extends Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  client: PublicClient<TTransport, TChain>
): DepositContractPublicActions => ({
  getDepositRoot: async (args) =>
    readContract(client, {
      abi: depositContractAbi,
      address: args.address || DEPOSIT_CONTRACT_ADDRESS,
      functionName: 'get_deposit_root',
    } as ReadContractParameters<typeof depositContractAbi, 'get_deposit_root'>),

  getDepositCount: async (args) =>
    readContract(client, {
      abi: depositContractAbi,
      address: args.address || DEPOSIT_CONTRACT_ADDRESS,
      functionName: 'get_deposit_count',
    } as ReadContractParameters<
      typeof depositContractAbi,
      'get_deposit_count'
    >),
})

export type DepositContractWalletActions = {
  deposit: (args: DepositParameters) => Promise<WriteContractReturnType>
}

export const depositContractWalletActions = <
  TTransport extends Transport,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
>(
  client: WalletClient<TTransport, TChain, TAccount>
): DepositContractWalletActions => ({
  deposit: async (args) =>
    writeContract(client, {
      abi: depositContractAbi,
      address: args.address || DEPOSIT_CONTRACT_ADDRESS,
      functionName: 'deposit',
      args: [
        args.nodePubkey,
        args.consensusPubkey,
        args.withdrawalCredentials,
        args.nodeSignature,
        args.consensusSignature,
        args.depositDataRoot,
      ],
      value: args.value,
    } as any),
})
