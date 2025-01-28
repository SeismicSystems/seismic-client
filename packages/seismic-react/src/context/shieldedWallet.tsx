import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  ShieldedPublicClient,
  ShieldedWalletClient,
  createShieldedPublicClient,
  createShieldedWalletClient,
} from 'seismic-viem'
import { custom, http } from 'viem'
import type { Transport } from 'viem'
import { useConnectorClient } from 'wagmi'
import type { Config } from 'wagmi'

interface WalletClientContextType {
  publicClient: ShieldedPublicClient | null
  walletClient: ShieldedWalletClient | null
  error: string | null
}

// Create the context
const WalletClientContext = createContext<WalletClientContextType | undefined>(
  undefined
)

// Custom hook for using the context
export const useShieldedWallet = () => {
  const context = useContext(WalletClientContext)
  if (context === undefined) {
    throw new Error(
      'useWalletClient must be used within a WalletClientProvider'
    )
  }
  return context
}

type ShieldedWalletProviderProps = {
  children: React.ReactNode
  config: Config
  options?: { publicTransport?: Transport }
}

// Provider component
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

  useEffect(() => {
    if (!isFetched || !data) {
      return
    }
    const { account, chain, transport } = data
    if (!account) {
      setError('No account connected')
      return
    }
    if (!transport) {
      setError('No transport connected')
      return
    }
    if (!chain) {
      setError('No chain connected')
      return
    }

    const publicTransport = options.publicTransport ?? (http() as Transport)

    const publicClient = createShieldedPublicClient({
      // @ts-ignore
      transport: publicTransport,
      // @ts-ignore
      chain,
    })
    setPublicClient(publicClient)

    createShieldedWalletClient({
      // @ts-ignore
      account,
      // @ts-ignore
      chain,
      // @ts-ignore
      transport: custom(transport),
      publicClient,
    }).then((wc) => setWalletClient(wc))
  }, [isFetched, data])

  // Create the value object that will be provided to consumers
  const value = {
    publicClient,
    walletClient,
    error,
  }

  return (
    <WalletClientContext.Provider value={value}>
      {children}
    </WalletClientContext.Provider>
  )
}
