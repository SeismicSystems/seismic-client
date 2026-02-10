import {
  createSeismicDevnet as createSeismicDevnetViem,
  localSeismicDevnet as localSeismicDevnetViem,
  sanvil as sanvilViem,
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

/** Seismic's testnet at:
 * - https: https://gcp-1.seismictest.net/rpc
 * - wss: wss://gcp-1.seismictest.net/ws
 * - explorer: https://seismic-testnet.socialscan.io
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
 * Creates a Seismic chain configuration.
 *
 * @param {CreateSeismicDevnetParams} params - The parameters for creating a Seismic chain.
 *   - `nodeHost` (string) - The hostname for the node (e.g. `gcp-1.seismictest.net`).
 *   - `explorerUrl` (string, optional) - Block explorer URL.
 *
 * @throws {Error} Throws if `nodeHost` is not provided.
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
 * const chain = createSeismicDevnet({ nodeHost: 'gcp-1.seismictest.net' });
 * ```
 */
export const createSeismicDevnet = (
  params: CreateSeismicDevnetParams
): RainbowKitChain => {
  return toRainbowKitChain(createSeismicDevnetViem(params))
}
