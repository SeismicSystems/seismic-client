import type { Account, Chain, Transport, PublicClient, WalletClient, ReadContractReturnType, WriteContractParameters } from "viem";

import type { WriteContractReturnType } from "viem";
import { readContract, writeContract } from "viem/actions";
import { getDepositContract } from "@sviem/abis/depositContract.ts";
import { Hex } from "viem";
import { depositContractAbi } from "@sviem/abis/depositContract.ts";

export type DepositContractActions = {
    deposit: (params: DepositParameters) => Promise<WriteContractReturnType>
    readDeposit: (params: ReadDepositParameters) => Promise<ReadContractReturnType>
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

export type ReadDepositParameters = {
    /** Validator BLS public key */
    pubkey: `0x${string}`
}

export async function deposit<
    TTransport extends Transport, 
    TChain extends Chain | undefined,
    TAccount extends Account
>(
    client: WalletClient<TTransport, TChain, TAccount>, 
    args: DepositParameters
): Promise<WriteContractReturnType> {
    return writeContract(client, {
        abi: depositContractAbi,
        address: args.address,
        functionName: 'deposit',
        args: [args.nodePubkey, args.consensusPubkey, args.withdrawalCredentials, args.nodeSignature, args.consensusSignature, args.depositDataRoot],
        value: args.value,
        chain: client.chain,
        account: client.account,
    } as WriteContractParameters<typeof depositContractAbi, 'deposit'>)
}