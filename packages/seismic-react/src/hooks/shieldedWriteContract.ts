import { useCallback, useState } from 'react'
import { shieldedWriteContract } from 'seismic-viem'
import type { Abi, ContractFunctionArgs, ContractFunctionName, Hex } from 'viem'

import { useShieldedWallet } from '@sreact/context/shieldedWallet.tsx'

export type UseShieldedWriteContractConfig<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  >,
> = {
  address: Hex
  abi: TAbi
  functionName: TFunctionName
  args?: TArgs
  gas?: bigint
  gasPrice?: bigint
}

/**
 * Similar to wagmi's {@link https://wagmi.sh/react/api/hooks/useWriteContract useWriteContract} hook,
 * but uses {@link shieldedWriteContract} instead.
 *
 * @param {UseShieldedWriteContractConfig} config - The configuration object.
 *   - `address` ({@link Hex}) - The address of the contract.
 *   - `abi` ({@link Abi}) - The contract ABI.
 *   - `functionName` (string) - The name of the contract function to call.
 *   - `args` (array) - The arguments to pass to the contract function.
 *   - `gas` (bigint) - Optional gas limit for the transaction.
 *   - `gasPrice` (bigint) - Optional gas price for the transaction.
 *
 * @returns {object} An object containing:
 *   - `writeContract` (function): A function to execute contract writes.
 *   - `isLoading` (boolean): Indicates if the write operation is in progress.
 *   - `hash` (string): The transaction hash from the last successful call to `writeContract`.
 *   - `error` (string): Any error message from the most recent call to `writeContract`, if present.
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
  gas,
  gasPrice,
}: UseShieldedWriteContractConfig<TAbi, TFunctionName, TArgs>) {
  const { walletClient } = useShieldedWallet()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hash, setHash] = useState<`0x${string}` | null>(null)

  // The write function that executes the shielded contract write
  const writeContract = useCallback(async () => {
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
        ...(gas && { gas }),
        ...(gasPrice && { gasPrice }),
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
  }, [walletClient, address, abi, functionName, args, gas, gasPrice])

  return {
    writeContract,
    write: writeContract,
    isLoading,
    error,
    hash,
  }
}
