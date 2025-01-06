import type {
  Account,
  BlockTag,
  Chain,
  GetStorageAtParameters,
  GetStorageAtReturnType,
  GetTransactionParameters,
  GetTransactionReturnType,
  Hex,
  RpcSchema,
  Transport,
} from 'viem'

import type { ShieldedPublicClient } from '@sviem/client'

export type ShieldedPublicActions<
  TChain extends Chain | undefined = Chain | undefined,
> = {
  getTeePublicKey: () => Promise<Hex | string>
  getStorageAt: (
    args: GetStorageAtParameters
  ) => Promise<GetStorageAtReturnType>
  getTransaction: (
    args: GetTransactionParameters
  ) => Promise<GetTransactionReturnType<TChain, BlockTag>>
}

export const shieldedPublicActions = <
  TTransport extends Transport,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
  TRpcSchema extends RpcSchema | undefined = undefined,
>(
  client: ShieldedPublicClient<TTransport, TChain, TAccount, TRpcSchema>
): ShieldedPublicActions<TChain> => ({
  getTeePublicKey: async () => {
    // @ts-ignore
    const key: Hex | string = await client.request({
      method: 'seismic_getTeePublicKey',
    })
    return key.startsWith('0x') ? key.slice(2) : key
  },
  getStorageAt: async (_args) => {
    throw new Error('Cannot call getStorageAt with a shielded public client')
  },
  getTransaction: async (_args) => {
    throw new Error('Cannot call getTransaction with a shielded public client')
  },
})
