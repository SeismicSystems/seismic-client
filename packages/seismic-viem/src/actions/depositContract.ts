import type { Account, Chain, Transport, PublicClient, WalletClient, ReadContractReturnType } from "viem";

import type { WriteContractReturnType } from "viem";
import { readContract, writeContract } from "viem/actions";
import { getDepositContract } from "@sviem/abis/depositContract.ts";

export type DepositContractActions = {
    deposit: (params: DepositParameters) => Promise<WriteContractReturnType>
    readDeposit: (params: ReadDepositParameters) => Promise<ReadContractReturnType>
}

export type DepositParameters = {
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

export async function deposit<TTransport extends Transport, TChain extends Chain, TAccount extends Account>(
    client: WalletClient<TTransport, TChain, TAccount>, 
    args: DepositParameters
) {
    const contract = getDepositContract()
    return writeContract(client, {
        abi: contract.abi,
        address: contract.address,
        functionName: 'deposit',
        args: [args.nodePubkey, args.consensusPubkey, args.withdrawalCredentials, args.nodeSignature, args.consensusSignature, args.depositDataRoot],
        value: args.value,
        chain: client.chain,
    })
}