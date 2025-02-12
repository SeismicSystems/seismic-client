import { useEffect, useState } from 'react'
import type { ShieldedContract } from 'seismic-viem'
import { getShieldedContract } from 'seismic-viem'
import type { Abi, Address } from 'viem'

import { useShieldedWallet } from '@sreact/context/shieldedWallet'

export type UseShieldedContractConfig<
  TAddress extends Address,
  TAbi extends Abi | readonly unknown[],
> = { abi: TAbi; address: TAddress }

/**
 * A React hook that exposes `contract`, which is returned by a call to {@link getShieldedContract}.
 *
 * @param {UseShieldedContractConfig} config - The configuration object.
 *   - `abi` ({@link Abi}) - The contract ABI.
 *   - `address` ({@link Address}) - The contract address.
 *
 * @returns The shielded contract instance.
 */
export function useShieldedContract<
  TAddress extends Address,
  const TAbi extends Abi | readonly unknown[],
>({ abi, address }: UseShieldedContractConfig<TAddress, TAbi>) {
  const { walletClient } = useShieldedWallet()
  const [contract, setContract] = useState<ShieldedContract | null>(null)

  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!walletClient) {
      setError(new Error('Shielded wallet client not initialized'))
      return
    }
    setError(null)
    const contract = getShieldedContract({ abi, address, client: walletClient })
    setContract(contract as any as ShieldedContract)
  }, [walletClient, abi, address])

  return {
    contract,
    error,
  }
}
