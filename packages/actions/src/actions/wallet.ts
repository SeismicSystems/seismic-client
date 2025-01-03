import type { Account, Chain, Hex, Transport } from 'viem'

import { ShieldedWalletClient } from '@actions/client'
import type { SignedReadContract } from '@actions/contract/read'
import { signedReadContract } from '@actions/contract/read'
import type { SeismicWriteContract } from '@actions/contract/write'
import { shieldedWriteContract } from '@actions/contract/write'
import type {
  SendSeismicTransactionParameters,
  SendSeismicTransactionRequest,
  SendSeismicTransactionReturnType,
} from '@actions/sendTransaction.js'
import { seismicSendTransaction } from '@actions/sendTransaction.js'
import { signedCall } from '@actions/signedCall'
import type { SignedCall } from '@actions/signedCall'

export type ShieldedWalletActions<
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
> = {
  writeContract: SeismicWriteContract<TChain, TAccount>
  readContract: SignedReadContract
  signedCall: SignedCall<TChain>
  seismicSendTransaction: <
    const request extends SendSeismicTransactionRequest<TChain, TChainOverride>,
    TChainOverride extends Chain | undefined = undefined,
  >(
    args: SendSeismicTransactionParameters<
      TChain,
      TAccount,
      TChainOverride,
      request
    >
  ) => Promise<SendSeismicTransactionReturnType>
  getEncryption: () => Hex
}

export const shieldedWalletActions = <
  TTransport extends Transport,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
>(
  client: ShieldedWalletClient<TTransport, TChain, TAccount>,
  encryption: Hex
): ShieldedWalletActions<TChain, TAccount> => {
  return {
    writeContract: (args) => shieldedWriteContract(client, args as any),
    readContract: (args) => signedReadContract(client, args as any),
    signedCall: (args) => signedCall(client, args as any),
    seismicSendTransaction: (args) =>
      seismicSendTransaction(client, args as any),
    getEncryption: () => encryption,
  }
}
