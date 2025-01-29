import { useCallback, useState } from 'react'
import { signedReadContract } from 'seismic-viem'
import type { Abi, ContractFunctionArgs, ContractFunctionName } from 'viem'

import { useShieldedWallet } from '@sreact/context/shieldedWallet'

export type UseSignedReadContractConfig<
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
 * Similar to wagmi's {@link https://wagmi.sh/react/api/hooks/useReadContract useReadContract} hook,
 * but uses {@link signedReadContract} instead
 */
export function useSignedReadContract<
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
}: UseSignedReadContractConfig<TAbi, TFunctionName, TArgs>) {
  const { walletClient } = useShieldedWallet()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // The write function that executes the shielded contract write
  const read = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    if (!walletClient) {
      setError(new Error('Shielded wallet client not initialized'))
      setIsLoading(false)
      return
    }

    try {
      const data = await signedReadContract(walletClient, {
        address,
        abi,
        functionName,
        ...(args && { args }),
      } as any)
      return data
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
    read,
    isLoading,
    error,
  }
}
