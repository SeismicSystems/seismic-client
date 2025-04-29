import { useCallback, useState } from 'react'
import { signedReadContract } from 'seismic-viem'
import type { Abi, ContractFunctionArgs, ContractFunctionName } from 'viem'

import { useShieldedWallet } from '@sreact/context/shieldedWallet.tsx'

export type UseSignedReadContractConfig<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TArgs extends ContractFunctionArgs<TAbi, 'pure' | 'view', TFunctionName>,
> = {
  address: `0x${string}`
  abi: TAbi
  functionName: TFunctionName
  args?: TArgs
}

/**
 * Similar to wagmi's {@link https://wagmi.sh/react/api/hooks/useReadContract useReadContract} hook,
 * but uses {@link signedReadContract} instead.
 *
 * @param {UseSignedReadContractConfig} config - The configuration object.
 *   - `address` ({@link Hex}) - The address of the contract.
 *   - `abi` ({@link Abi}) - The contract ABI.
 *   - `functionName` (string) - The name of the contract function to call.
 *   - `args` (array) - The arguments to pass to the contract function.
 *
 * @returns {object} An object containing:
 *   - `signedRead` (function): A function to execute signed reads.
 *   - `isLoading` (boolean): Indicates if the read operation is in progress.
 *   - `hash` (string): The transaction hash from the last successful call to `signedRead`.
 *   - `error` (string): Any error message from the most recent call to `signedRead`, if present.
 */
export function useSignedReadContract<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TArgs extends ContractFunctionArgs<TAbi, 'pure' | 'view', TFunctionName>,
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
  const signedRead = useCallback(async () => {
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
    signedRead,
    read: signedRead,
    isLoading,
    error,
  }
}
