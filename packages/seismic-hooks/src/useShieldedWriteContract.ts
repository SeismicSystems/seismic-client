import { useCallback, useEffect, useState } from 'react'
import type {
  Abi,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  Transport,
} from 'viem'
import { custom, http } from 'viem'
import { useConnectorClient } from 'wagmi'

import { config } from '@shooks/config/seismicDevnet'
import {
  createShieldedPublicClient,
  createShieldedWalletClient,
} from '@sviem/client'
import type { ShieldedPublicClient, ShieldedWalletClient } from '@sviem/client'
import { shieldedWriteContract } from '@sviem/contract/write'

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

/**
Usage:
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
export function useShieldedWriteContract<
  TAbi extends Abi | readonly unknown[],
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
  const { data, isFetched } = useConnectorClient({ config })

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
      if (!isFetched || !data) return

      const { account, chain, transport } = data
      if (!account) throw new Error('No account connected')
      if (!transport) throw new Error('No transport connected')
      if (!chain) throw new Error('No chain connected')

      try {
        const publicClient = await createShieldedPublicClient({
          transport: http(),
          chain,
        })

        const walletClient = await createShieldedWalletClient({
          account,
          chain,
          transport: custom(transport),
          publicClient,
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
        console.log('err', err)
      }
    }

    initShieldedClients()
  }, [data])

  // The write function that executes the shielded contract write
  const write = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setHash(null)

    if (!shieldedClients.wallet) {
      setError(new Error('Shielded wallet client not initialized'))
      return
    }

    try {
      const tx = await shieldedWriteContract(shieldedClients.wallet, {
        address,
        abi,
        functionName,
        ...(args && { args }),
      } as any)
      console.log('tx', tx)
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
