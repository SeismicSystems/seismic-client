import {
  createSeismicDevnet as createSeismicDevnetViem,
  localSeismicDevnet as localSeismicDevnetViem,
  sanvil as sanvilViem,
  seismicDevnet1 as seismicDevnetViem1,
  seismicDevnet2 as seismicDevnetViem2,
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

export const seismicDevnet = toRainbowKitChain(seismicDevnetViem1)
export const seismicDevnet1 = toRainbowKitChain(seismicDevnetViem1)
export const seismicDevnet2 = toRainbowKitChain(seismicDevnetViem2)
export const sanvil = toRainbowKitChain(sanvilViem as ViemChain)
export const localSeismicDevnet = toRainbowKitChain(
  localSeismicDevnetViem as ViemChain
)

export const createSeismicDevnet = (node: number) => {
  return toRainbowKitChain(createSeismicDevnetViem(node))
}
