import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from 'wagmi/chains'

import { Chain, getDefaultConfig } from '@rainbow-me/rainbowkit'

const seismicDevnet = {
  id: 31337,
  name: 'Seismic',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  iconUrl:
    'https://seismic-public-assets.s3.us-east-1.amazonaws.com/seismic-logo-light.png',
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    default: { name: 'SeismicScan', url: 'http://127.0.0.1:8545' },
  },
} as const satisfies Chain

export const config = getDefaultConfig({
  appName: 'Walnut App',
  projectId: 'YOUR_PROJECT_ID',
  chains: [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    seismicDevnet as Chain,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [sepolia] : []),
  ],
  ssr: true,
})
