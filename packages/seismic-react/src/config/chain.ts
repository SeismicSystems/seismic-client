import {
  localSeismicDevnet as localSeismicDevnetViem,
  sanvil as sanvilViem,
  seismicDevnet as seismicDevnetViem,
} from 'seismic-viem'
import type { Chain as ViemChain } from 'viem'

import { Chain as RainbowKitChain } from '@rainbow-me/rainbowkit'

const toRainbowKitChain = (chain: ViemChain): RainbowKitChain => {
  return {
    id: chain.id,
    name: chain.name,
    iconUrl:
      'https://seismic-public-assets.s3.us-east-1.amazonaws.com/seismic-logo-light.png',
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: chain.rpcUrls,
    blockExplorers: chain.blockExplorers,
    formatters: chain.formatters,
  }
}

export const seismicDevnet = toRainbowKitChain(seismicDevnetViem as ViemChain)
export const sanvil = toRainbowKitChain(sanvilViem as ViemChain)
export const localSeismicDevnet = toRainbowKitChain(
  localSeismicDevnetViem as ViemChain
)

export const createSeismicDevnet = (node: number) => {
  const hostname = `node-${node}.seismicdev.net`
  return toRainbowKitChain({
    id: 1337,
    name: 'Seismic',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: {
      default: {
        http: [`https://${hostname}/rpc`],
        webSocket: [`wss://${hostname}/ws`],
      },
    },
    blockExplorers: {
      default: {
        name: 'SeismicScan',
        url: `https://explorer-${node}.seismicdev.net`,
      },
    },
  })
}
