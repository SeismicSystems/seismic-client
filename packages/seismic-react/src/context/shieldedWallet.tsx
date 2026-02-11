import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  ShieldedPublicClient,
  ShieldedWalletClient,
  createShieldedPublicClient,
  createShieldedWalletClient,
} from 'seismic-viem'
import { custom, http } from 'viem'
import type { Chain, Hex, Transport } from 'viem'
import { useConnectorClient } from 'wagmi'
import type { Config } from 'wagmi'

interface WalletClientContextType {
  publicClient: ShieldedPublicClient | null
  walletClient: ShieldedWalletClient | null
  address: Hex | null
  error: string | null
  loaded: boolean
}

// Create the context
const WalletClientContext = createContext<WalletClientContextType | undefined>(
  undefined
)

/**
 * A react hook callable when there is a {@link WalletClientProvider} present
 *
 * @example
 * ```typescript
 * import { useShieldedWallet } from 'seismic-react'
 *
 * // inside your component:
 * const { publicClient, walletClient } = useShieldedWallet()
 * ```
 */
export const useShieldedWallet = () => {
  const context = useContext(WalletClientContext)
  if (context === undefined) {
    throw new Error(
      'useWalletClient must be used within a WalletClientProvider'
    )
  }
  return context
}

export type OnAddressChangeParams = {
  publicClient: ShieldedPublicClient
  walletClient: ShieldedWalletClient
  address: Hex
}

type ShieldedWalletProviderProps = {
  children: React.ReactNode
  config: Config
  options?: {
    publicTransport?: Transport
    publicChain?: Chain
    onAddressChange?: (params: OnAddressChangeParams) => Promise<void>
  }
}

/**
 * React context that provides a shielded wallet client
 *
 * @param {ShieldedWalletProviderProps} props - The properties for the ShieldedWalletProvider component.
 *   - `config` (Config) - The configuration for initializing the shielded wallet client.
 *   - `options` (object, optional) - Additional options:
 *     - `publicTransport` (Transport, optional) - An optional transport layer for public interactions.
 *     - `publicChain` (Chain, optional) - An optional chain configuration for public interactions.
 *
 * @example
 * An example next.js app might look like:
 * ```typescript
 * import type { AppProps } from 'next/app';
 * import { getDefaultConfig } from '@rainbow-me/rainbowkit'
 * import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
 * import { WagmiProvider } from 'wagmi'
 * import { ShieldedWalletProvider, seismicTestnet } from 'seismic-react'
 *
 * const client = new QueryClient();
 *
 * export default function MyApp({ Component, pageProps }: AppProps) {
 *   return (
 *     <WagmiProvider config={config}>
 *       <QueryClientProvider client={client}>
 *         <RainbowKitProvider>
 *           <ShieldedWalletProvider config={config}>
 *             <Component {...pageProps} />
 *           </ShieldedWalletProvider>
 *         </RainbowKitProvider>
 *       </QueryClientProvider>
 *     </WagmiProvider>
 *   )
 * }
 * ```
 */
export const ShieldedWalletProvider: React.FC<ShieldedWalletProviderProps> = ({
  children,
  config,
  options = {},
}) => {
  const { data, isFetched } = useConnectorClient({ config })
  const [error, setError] = useState<string | null>(null)
  const [publicClient, setPublicClient] = useState<ShieldedPublicClient | null>(
    null
  )
  const [walletClient, setWalletClient] = useState<ShieldedWalletClient | null>(
    null
  )
  const [address, setAddress] = useState<Hex | null>(null)
  const [callingOnAddressChange, setCallingOnAddressChange] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!publicClient) {
      // don't overwrite any errors coming from second effect
      setError(null)
    }
    const publicTransport = options.publicTransport ?? (http() as Transport)
    if (options.publicChain) {
      const publicClient = createShieldedPublicClient({
        // @ts-ignore
        transport: publicTransport,
        // @ts-ignore
        chain: options.publicChain,
      })
      setPublicClient(publicClient)
      return
    }

    if (!isFetched || !data) {
      setError('Failed to create public client: Connector not fetched')
      return
    }

    const { chain } = data
    if (!chain) {
      setError('Failed to create public client: No chain connected')
      return
    }
    const pubClient = createShieldedPublicClient({
      transport: publicTransport,
      chain,
    })
    setPublicClient(pubClient)
  }, [data, isFetched, options.publicChain, options.publicTransport])

  const resetWallet = () => {
    setWalletClient(null)
    setAddress(null)
    setLoaded(false)
  }

  useEffect(() => {
    if (!publicClient) {
      // Don't set error here, since it would overwrite
      // the root cause error from above effect
      return
    }
    setError(null)

    if (!isFetched || !data) {
      setError('Failed to create shielded client: Connector not fetched')
      resetWallet()
      return
    }

    const { account, chain, transport } = data
    if (!account) {
      setError('Failed to create shielded client: No account connected')
      resetWallet()
      return
    }
    if (!transport) {
      setError('Failed to create shielded client: No transport connected')
      resetWallet()
      return
    }
    if (!chain) {
      setError('Failed to create shielded client: No chain connected')
      resetWallet()
      return
    }

    createShieldedWalletClient({
      // @ts-ignore
      account,
      // @ts-ignore
      chain,
      // @ts-ignore
      transport: custom(transport),
      publicClient,
    })
      .then((wc: ShieldedWalletClient) => {
        setWalletClient(wc)
        setAddress(wc.account.address)
        setLoaded(true)
      })
      .catch((error) => {
        setError(error.message)
        resetWallet()
      })
  }, [publicClient, isFetched, data])

  useEffect(() => {
    if (!options.onAddressChange || callingOnAddressChange) {
      return
    }

    if (publicClient && walletClient && address) {
      setCallingOnAddressChange(true)
      options
        .onAddressChange({ publicClient, walletClient, address })
        .catch((error) => {
          console.error(
            'useShieldedWallet threw error calling onAddressChange: ',
            error
          )
        })
        .finally(() => {
          setCallingOnAddressChange(false)
        })
    }
  }, [options.onAddressChange, publicClient, walletClient, address])

  // Create the value object that will be provided to consumers
  const value = {
    publicClient,
    walletClient,
    address,
    error,
    loaded,
  }

  return (
    <WalletClientContext.Provider value={value}>
      {children}
    </WalletClientContext.Provider>
  )
}
