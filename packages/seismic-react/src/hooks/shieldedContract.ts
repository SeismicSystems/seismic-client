import { useEffect, useState } from 'react'
import type { ShieldedContract } from 'seismic-viem'
import { getShieldedContract } from 'seismic-viem'
import type { Abi, Address } from 'viem'

import { useShieldedWallet } from '@sreact/context/shieldedWallet'

/**
 * A react hook that exposes `contract`, which is returned by a call to {@link getShieldedContract}
 */
export function useShieldedContract<
  TAddress extends Address,
  const TAbi extends Abi | readonly unknown[],
>({ abi, address }: { abi: TAbi; address: TAddress }) {
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
