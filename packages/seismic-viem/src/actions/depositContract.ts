import type {
  Account,
  Chain,
  PublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  Transport,
  WalletClient,
  WriteContractParameters,
} from 'viem'
import type { WriteContractReturnType } from 'viem'
import { readContract, writeContract } from 'viem/actions'

import { depositContractAbi } from '@sviem/abis/depositContract.ts'

export type DepositParameters = {
  /** Deposit contract address */
  address: `0x${string}`
  /** Validator public key*/
  nodePubkey: `0x${string}`
  /** Consensus public key */
  consensusPubkey: `0x${string}`
  /** Withdrawal credentials */
  withdrawalCredentials: `0x${string}`
  /** Node signature */
  nodeSignature: `0x${string}`
  /** Consensus signature */
  consensusSignature: `0x${string}`
  /** Deposit data root */
  depositDataRoot: `0x${string}`
  /** Amount of ETH to deposit */
  value: bigint
}

export type GetDepositRootParameters = {
  /** Deposit contract address */
  address: `0x${string}`
}

export type GetDepositCountParameters = {
  /** Deposit contract address */
  address: `0x${string}`
}


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
      address: args.address,
      functionName: 'get_deposit_root',
    } as ReadContractParameters<typeof depositContractAbi, 'get_deposit_root'>),

  getDepositCount: async (args) =>
    readContract(client, {
      abi: depositContractAbi,
      address: args.address,
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
      address: args.address,
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
