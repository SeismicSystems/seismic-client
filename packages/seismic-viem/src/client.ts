import type {
  Account,
  Chain,
  Client,
  Hex,
  Prettify,
  PublicActions,
  PublicRpcSchema,
  RpcSchema,
  Transport,
  WalletActions,
} from 'viem'
import {
  createClient,
  createPublicClient,
  http,
  publicActions,
  walletActions,
} from 'viem'
import type { PublicClientConfig } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'

import type { ShieldedPublicActions } from '@sviem/actions/public'
import { shieldedPublicActions } from '@sviem/actions/public'
import type { ShieldedWalletActions } from '@sviem/actions/wallet'
import { shieldedWalletActions } from '@sviem/actions/wallet'
import { generateAesKey } from '@sviem/crypto/aes'

export type ShieldedPublicClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  accountOrAddress extends Account | undefined = undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
  Client<
    transport,
    chain,
    accountOrAddress,
    rpcSchema extends RpcSchema
      ? [...PublicRpcSchema, ...rpcSchema]
      : PublicRpcSchema,
    PublicActions<transport, chain> & ShieldedPublicActions<chain>
  >
>

export type ShieldedWalletClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
> = Client<
  transport,
  chain,
  account,
  RpcSchema,
  PublicActions<transport, chain, account> &
    WalletActions<chain, account> &
    ShieldedWalletActions<chain, account>
>

type SeismicClients<
  transport extends Transport,
  chain extends Chain | undefined,
  account extends Account | undefined,
> = {
  public: ShieldedPublicClient<transport, chain, undefined>
  wallet: ShieldedWalletClient<transport, chain, account>
  encryption: Hex
}

type GetPublicClientParameters = {
  chain: Chain
  transport: Transport
}

type GetSeismicClientsParameters = GetPublicClientParameters & {
  privateKey: Hex
}

export function createShieldedPublicClient<
  transport extends Transport,
  chain extends Chain | undefined = undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
>(
  parameters: PublicClientConfig<transport, chain, undefined, rpcSchema>
): ShieldedPublicClient<transport, chain, undefined, rpcSchema> {
  const viemPublicClient = createPublicClient<
    transport,
    chain,
    undefined,
    rpcSchema
  >(parameters) as ShieldedPublicClient<transport, chain, undefined, rpcSchema>
  // @ts-ignore
  return viemPublicClient.extend(shieldedPublicActions) as any
}

const getSeismicClients = async ({
  chain,
  transport,
  privateKey,
}: GetSeismicClientsParameters): Promise<
  SeismicClients<Transport, Chain, Account>
> => {
  const publicClient = createShieldedPublicClient({ chain, transport })
  const networkPublicKey = await publicClient.getTeePublicKey()
  const encryption = await generateAesKey({ privateKey, networkPublicKey })
  const account = privateKeyToAccount(privateKey)
  const wallet = createClient({ account, chain, transport })
    .extend(publicActions)
    .extend(walletActions)
    // @ts-ignore
    .extend(shieldedPublicActions)
    // @ts-ignore
    .extend((c) => shieldedWalletActions(c, encryption))

  return {
    public: publicClient,
    wallet,
    encryption,
  }
}

export const createShieldedWalletClient = async ({
  chain,
  transport,
  privateKey,
}: GetSeismicClientsParameters): Promise<
  ShieldedWalletClient<Transport, Chain, Account>
> => {
  const clients = await getSeismicClients({ chain, transport, privateKey })
  return clients.wallet
}

export const getSeismicAnvilClients = (
  privateKey: Hex
): Promise<SeismicClients<Transport, Chain, Account>> => {
  return getSeismicClients({
    chain: anvil,
    transport: http('http://127.0.0.1:8545'),
    privateKey,
  })
}
