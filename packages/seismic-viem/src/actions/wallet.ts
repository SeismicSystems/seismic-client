import type { Account, Chain, Hex, Transport } from 'viem'

import { ShieldedWalletClient } from '@sviem/client'
import type { SignedReadContract } from '@sviem/contract/read'
import { signedReadContract } from '@sviem/contract/read'
import type { SeismicWriteContract } from '@sviem/contract/write'
import { shieldedWriteContract } from '@sviem/contract/write'
import type {
  SendSeismicTransactionParameters,
  SendSeismicTransactionRequest,
  SendSeismicTransactionReturnType,
} from '@sviem/sendTransaction.js'
import { sendShieldedTransaction } from '@sviem/sendTransaction.js'
import { signedCall } from '@sviem/signedCall'
import type { SignedCall } from '@sviem/signedCall'

export type ShieldedWalletActions<
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
> = {
  writeContract: SeismicWriteContract<TChain, TAccount>
  readContract: SignedReadContract
  signedCall: SignedCall<TChain>
  sendShieldedTransaction: <
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
    sendShieldedTransaction: (args) =>
      sendShieldedTransaction(client, args as any),
    getEncryption: () => encryption,
  }
}
