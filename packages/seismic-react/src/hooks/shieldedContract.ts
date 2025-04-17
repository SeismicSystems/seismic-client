import { useEffect, useState } from 'react'
import type { ShieldedContract } from 'seismic-viem'
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
  TChain extends Chain | undefined,
> = {
  contract: ShieldedContract<CustomTransport, TAddress, TAbi, TChain> | null
  publicContract: ShieldedContract<
    CustomTransport,
    TAddress,
    TAbi,
    TChain,
    undefined
  > | null
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
  const { publicClient, walletClient } = useShieldedWallet()
  type ShieldedContractType = ShieldedContract<
    CustomTransport,
    TAddress,
    TAbi,
    Chain | undefined,
    Account
  >

  const [contract, setContract] = useState<ShieldedContractType | null>(null)
  const [publicContract, setPublicContract] =
    useState<ShieldedContractType | null>(null)

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

  useEffect(() => {
    if (!publicClient) {
      setError(new Error('Public client not initialized'))
      return
    }
    setError(null)
    const publicContract = getShieldedContract({
      abi,
      address,
      client: publicClient,
    })
    setPublicContract(publicContract)
  }, [publicClient, abi, address])

  return {
    contract,
    publicContract,
    abi,
    address,
    error,
  }
}
