import { useCallback, useEffect, useState } from 'react'
import {
  type Abi,
  type Account,
  type Chain,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type Transport,
  http,
} from 'viem'
import { useConnectorClient } from 'wagmi'
import { writeContract } from 'wagmi/actions'

import {
  type ShieldedPublicClient,
  type ShieldedWalletClient,
  createShieldedPublicClient,
  createShieldedWalletClient,
} from '@sviem/index'

import { config } from '@shooks/config/seismicDevnet'

export type UseShieldedWriteContractConfig<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  >,
> = {
  address: `0x${string}`
  abi: TAbi
  functionName: TFunctionName
  args?: TArgs
}

export function useShieldedWriteContract<
  const TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  >,
>({
  address,
  abi,
  functionName,
  args,
}: UseShieldedWriteContractConfig<TAbi, TFunctionName, TArgs>) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const extractedWalletClient = useConnectorClient()

  // Store the shielded client instances
  const [shieldedClients, setShieldedClients] = useState<{
    wallet: ShieldedWalletClient<Transport, Chain | undefined, Account> | null
    public: ShieldedPublicClient<
      Transport,
      Chain | undefined,
      undefined,
      undefined
    > | null
  }>({
    wallet: null,
    public: null,
  })

  // Initialize shielded clients when a wallet is connected
  useEffect(() => {
    const initShieldedClients = async () => {
      try {
        const account = extractedWalletClient.data?.account
        if (!account) throw new Error('No account connected')

        const transport = extractedWalletClient.data?.transport
        if (!transport) throw new Error('No transport connected')

        const chain = extractedWalletClient.data?.chain
        if (!chain) throw new Error('No chain connected')

        // Initialize the shielded public client    
        const publicClient = await createShieldedPublicClient({
          transport: http(),
          chain,
        })

        const walletClient = await createShieldedWalletClient({
          chain,
          transport: http(),
          account,
        })

        setShieldedClients({
          wallet: walletClient,
          public: publicClient,
        })
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to initialize shielded clients')
        )
      }
    }

    initShieldedClients()
  }, [extractedWalletClient.data])

  // The write function that executes the shielded contract write
  const write = useCallback(async () => {
    console.log('write', shieldedClients.wallet)
    if (!shieldedClients.wallet) {
      throw new Error(
        'Shielded wallet client not initialized, the wallet is: ' +
          shieldedClients.wallet
      )
    }

    setIsLoading(true)
    setError(null)

    try {
      const tx = await writeContract( // TODO: use shieldedWriteContract
        config,
        // shieldedClients.wallet, // TODO: use shielded wallet client
        {
          address,
          abi,
          functionName,
          ...(args && { args }),
        } as any
      )
      setHash(tx)
      return tx
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Error executing shielded write')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [shieldedClients.wallet, address, abi, functionName, args])

  return {
    write,
    isLoading,
    error,
    hash,
    shieldedClients,
  }
}

// Usage example:
/*
const { write, isLoading, error, hash } = useShieldedWriteContract({
  address: '0x...',
  abi: myContractAbi,
  functionName: 'myFunction',
  args: [arg1, arg2]
})

try {
  const tx = await write()
  console.log('Transaction hash:', tx)
} catch (error) {
  console.error('Error:', error)
}
*/
