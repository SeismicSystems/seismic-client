import {
  createSeismicDevnet as createSeismicDevnetViem,
  localSeismicDevnet as localSeismicDevnetViem,
  sanvil as sanvilViem,
  seismicDevnet1 as seismicDevnetViem1,
  seismicDevnet2 as seismicDevnetViem2,
  seismicTestnet as seismicTestnetViem,
} from 'seismic-viem'
import type { CreateSeismicDevnetParams } from 'seismic-viem'
import type { Chain as ViemChain } from 'viem'

import type { Chain as RainbowKitChain } from '@rainbow-me/rainbowkit'

const toRainbowKitChain = (chain: ViemChain): RainbowKitChain => {
  return {
    id: chain.id,
    name: chain.name,
    iconUrl:
      'https://seismic-public-assets.s3.amazonaws.com/seismic-logo-light.png',
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: chain.rpcUrls,
    blockExplorers: chain.blockExplorers,
    formatters: chain.formatters,
  }
}

/** The Seismic devnet at:
 * - https: https://node-1.seismicdev.net/rpc
 * - wss: wss://node-1.seismicdev.net/ws
 * - explorer: https://explorer-1.seismicdev.net
 * */
export const seismicDevnet1 = toRainbowKitChain(seismicDevnetViem1)

/** The Seismic devnet at:
 * - https: https://node-2.seismicdev.net/rpc
 * - wss: wss://node-2.seismicdev.net/ws
 * - explorer: https://explorer-2.seismicdev.net
 * */
export const seismicDevnet2 = toRainbowKitChain(seismicDevnetViem2)

/** An alias for {@link seismicDevnet1} */
export const seismicDevnet = toRainbowKitChain(seismicDevnetViem1)

/** Seismic's testnet at:
 * - https: https://internal-testnet.seismictest.net/rpc
 * - wss: wss://internal-testnet.seismictest.net/ws
 * - explorer: https://explorer.
 */
export const seismicTestnet = toRainbowKitChain(seismicTestnetViem)

/**
 * For connecting to a locally-running seismic anvil instance.
 * Use {@link https://seismic-2.gitbook.io/seismic-book/getting-started/publish-your-docs#sforge-sanvil-and-ssolc sfoundryup}  to install this
 */
export const sanvil = toRainbowKitChain(sanvilViem as ViemChain)

/**
 * For connecting to a locally-running seismic-reth instance on --dev mode
 */
export const localSeismicDevnet = toRainbowKitChain(
  localSeismicDevnetViem as ViemChain
)

/**
 * Creates a Seismic development network chain configuration.
 *
 * @param {CreateSeismicDevnetParams} params - The parameters for creating a Seismic devnet.
 *   - `node` (number, optional) - The node number for the devnet. If provided without `nodeHost`,
 *     the hostname will be generated as `node-{node}.seismicdev.net`.
 *   - `nodeHost` (string, optional) - The direct hostname for the node. Required if `node` is not provided.
 *   - `explorerUrl` (string, optional) - Custom block explorer URL. If not provided and `node` exists,
 *     defaults to `https://explorer-{node}.seismicdev.net`.
 *
 * @throws {Error} Throws if neither node number nor nodeHost is provided.
 *
 * @returns {RainbowKitChain} A chain configuration object containing:
 *   - Chain ID: 5124.
 *   - Network name: 'Seismic'.
 *   - Native ETH currency configuration.
 *   - RPC URLs (HTTP and WebSocket endpoints).
 *   - Block explorer configuration (if applicable).
 *   - Seismic-specific transaction formatters.
 *
 * @example
 * ```typescript
 * // Create using node number
 * const devnet1 = createSeismicDevnet({ node: 1 });
 *
 * // Create using custom host
 * const devnet2 = createSeismicDevnet({ nodeHost: 'custom.node.example.com' });
 * ```
 */
export const createSeismicDevnet = (
  params: CreateSeismicDevnetParams
): RainbowKitChain => {
  return toRainbowKitChain(createSeismicDevnetViem(params))
}
