import type { Account, Chain, Hex, Transport } from 'viem'

import type { WatchSRC20EventsParams } from '@sviem/actions/src20/types.ts'
import { watchSRC20Events } from '@sviem/actions/src20/watchSRC20Events.ts'
import { watchSRC20EventsWithKey } from '@sviem/actions/src20/watchSRC20EventsWithKey.ts'
import type {
  ShieldedPublicClient,
  ShieldedWalletClient,
} from '@sviem/client.ts'

/** Actions for SRC20 on a public client */
export type SRC20PublicActions = {
  watchSRC20EventsWithKey: (
    viewingKey: Hex,
    params: WatchSRC20EventsParams
  ) => Promise<() => void>
}

/** Actions for SRC20 on a wallet client */
export type SRC20WalletActions = {
  watchSRC20Events: (params: WatchSRC20EventsParams) => Promise<() => void>
}

/**
 * SRC20 actions for a public client.
 *
 * @example
 * ```typescript
 * const publicClient = createShieldedPublicClient(...)
 *   .extend(src20PublicActions)
 *
 * const unwatch = await publicClient.watchSRC20EventsWithKey(viewingKey, {
 *   address: '0x...',
 *   onTransfer: (log) => console.log(log),
 * })
 * ```
 */
export const src20PublicActions = <
  TTransport extends Transport,
  TChain extends Chain | undefined = Chain | undefined,
>(
  client: ShieldedPublicClient<TTransport, TChain>
): SRC20PublicActions => ({
  watchSRC20EventsWithKey: (viewingKey, params) =>
    watchSRC20EventsWithKey(client as any, viewingKey, params),
})

/**
 * SRC20 actions for a wallet client.
 *
 * @example
 * ```typescript
 * const walletClient = createShieldedWalletClient(...)
 *   .extend(src20WalletActions)
 *
 * const unwatch = await walletClient.watchSRC20Events({
 *   address: '0x...',
 *   onTransfer: (log) => console.log(log),
 * })
 * ```
 */
export const src20WalletActions = <
  TTransport extends Transport,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account = Account,
>(
  client: ShieldedWalletClient<TTransport, TChain, TAccount>
): SRC20WalletActions => ({
  watchSRC20Events: (params) => watchSRC20Events(client as any, params),
})
