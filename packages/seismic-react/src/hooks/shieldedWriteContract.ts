import { useCallback, useState } from 'react'
import { shieldedWriteContract } from 'seismic-viem'
import type { Abi, ContractFunctionArgs, ContractFunctionName } from 'viem'

import { useShieldedWallet } from '@sreact/context/shieldedWallet'

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
 * Similar to wagmi's {@link https://wagmi.sh/react/api/hooks/useWriteContract useWriteContract} hook,
 * but uses {@link shieldedWriteContract} instead
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
  const { walletClient } = useShieldedWallet()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hash, setHash] = useState<`0x${string}` | null>(null)

  // The write function that executes the shielded contract write
  const write = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setHash(null)

    if (!walletClient) {
      setError(new Error('Shielded wallet client not initialized'))
      return
    }

    try {
      const tx = await shieldedWriteContract(walletClient, {
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
  }, [walletClient, address, abi, functionName, args])

  return {
    write,
    isLoading,
    error,
    hash,
  }
}
