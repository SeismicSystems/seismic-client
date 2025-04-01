import { useEffect, useState } from 'react'
import type { ShieldedContract, ShieldedWalletClient } from 'seismic-viem'
import { getShieldedContract } from 'seismic-viem'
import type { Abi, Account, Address, Chain, CustomTransport } from 'viem'

import { useShieldedWallet } from '@sreact/context/shieldedWallet.tsx'

export type UseShieldedContractConfig<
  TAddress extends Address,
  TAbi extends Abi | readonly unknown[],
> = { abi: TAbi; address: TAddress }

export type UseShieldedContractResult<
  TAddress extends Address,
  TAbi extends Abi | readonly unknown[],
> = {
  contract: ShieldedContract<CustomTransport, TAddress, TAbi> | null
  abi: TAbi
  address: TAddress
  error: Error | null
}

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
>({
  abi,
  address,
}: UseShieldedContractConfig<TAddress, TAbi>): UseShieldedContractResult<
  TAddress,
  TAbi
> {
  const { walletClient } = useShieldedWallet()
  type ShieldedContractType = ShieldedContract<
    CustomTransport,
    TAddress,
    TAbi,
    Chain | undefined,
    Account,
    ShieldedWalletClient<CustomTransport, Chain | undefined, Account>
  >

  const [contract, setContract] = useState<ShieldedContractType | null>(null)

  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!walletClient) {
      setError(new Error('Shielded wallet client not initialized'))
      return
    }
    setError(null)
    const contract = getShieldedContract({ abi, address, client: walletClient })
    setContract(contract)
  }, [walletClient, abi, address])

  return {
    contract,
    abi,
    address,
    error,
  }
}
