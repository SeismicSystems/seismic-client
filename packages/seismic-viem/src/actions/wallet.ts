import type { Account, Chain, Hex, Transport } from 'viem'
import { readContract, writeContract } from 'viem/actions'

import { ShieldedWalletClient } from '@sviem/client'
import { signedReadContract } from '@sviem/contract/read'
import { shieldedWriteContract } from '@sviem/contract/write'
import type {
  SendSeismicTransactionParameters,
  SendSeismicTransactionRequest,
  SendSeismicTransactionReturnType,
} from '@sviem/sendTransaction.js'
import { sendShieldedTransaction } from '@sviem/sendTransaction.js'
import { signedCall } from '@sviem/signedCall'
import type { SignedCall } from '@sviem/signedCall'
import type { ReadContract, WriteContract } from '@sviem/viem-internal/contract'

export type ShieldedWalletActions<
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
> = {
  writeContract: WriteContract<TChain, TAccount>
  twriteContract: WriteContract<TChain, TAccount>
  readContract: ReadContract
  treadContract: ReadContract
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
  TAccount extends Account = Account,
>(
  client: ShieldedWalletClient<TTransport, TChain, TAccount>,
  encryption: Hex
): ShieldedWalletActions<TChain, TAccount> => {
  return {
    writeContract: (args) => shieldedWriteContract(client, args as any),
    readContract: (args) => signedReadContract(client, args as any),
    treadContract: (args) => readContract(client, args as any),
    twriteContract: (args) => writeContract(client, args as any),
    signedCall: (args) => signedCall(client, args as any),
    sendShieldedTransaction: (args) =>
      sendShieldedTransaction(client, args as any),
    getEncryption: () => encryption,
  }
}
