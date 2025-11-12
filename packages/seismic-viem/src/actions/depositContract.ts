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
import { Hex } from 'viem'
import { readContract, writeContract } from 'viem/actions'

import { getDepositContract } from '@sviem/abis/depositContract.ts'
import { depositContractAbi } from '@sviem/abis/depositContract.ts'

export type DepositContractActions = {
  deposit: (params: DepositParameters) => Promise<WriteContractReturnType>
  getDepositRoot: () => Promise<ReadContractReturnType>
  getDepositCount: () => Promise<ReadContractReturnType>
}

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

export async function deposit<
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
>(
  client: WalletClient<TTransport, TChain, TAccount>,
  args: DepositParameters
): Promise<WriteContractReturnType> {
  return writeContract(client, {
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
    chain: client.chain,
    account: client.account,
  } as WriteContractParameters<typeof depositContractAbi, 'deposit'>)
}

export async function getDepositRoot<
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
>(
  client: WalletClient<TTransport, TChain, TAccount>,
  args: GetDepositRootParameters
): Promise<ReadContractReturnType> {
  return readContract(client, {
    abi: depositContractAbi,
    address: args.address,
    functionName: 'get_deposit_root',
  } as ReadContractParameters<typeof depositContractAbi, 'get_deposit_root'>)
}

export async function getDepositCount<
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
>(
  client: WalletClient<TTransport, TChain, TAccount>,
  args: GetDepositCountParameters
): Promise<ReadContractReturnType> {
  return readContract(client, {
    abi: depositContractAbi,
    address: args.address,
    functionName: 'get_deposit_count',
  } as ReadContractParameters<typeof depositContractAbi, 'get_deposit_count'>)
}
