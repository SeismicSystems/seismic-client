import type { Address, Hex } from 'viem'
import { keccak256 } from 'viem'

import { DIRECTORY_ADDRESS } from '@sviem/abis/directory.ts'
import { DirectoryAbi } from '@sviem/abis/directory.ts'
import type { ShieldedWalletClient } from '@sviem/client.ts'
import { signedReadContract } from '@sviem/contract/read.ts'
import { shieldedWriteContract } from '@sviem/contract/write.ts'

const TX_TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Transaction timed out after ${ms}ms`)),
      ms
    )
  )
  return Promise.race([promise, timeout])
}

export async function checkRegistration(
  client: ShieldedWalletClient,
  address: Address
): Promise<boolean> {
  const hasKey = await client.readContract({
    address: DIRECTORY_ADDRESS,
    abi: DirectoryAbi,
    functionName: 'checkHasKey',
    args: [address],
  })
  return hasKey as boolean
}

export async function getKeyHash(
  client: ShieldedWalletClient,
  address: Address
): Promise<Hex> {
  const keyHash = await client.readContract({
    address: DIRECTORY_ADDRESS,
    abi: DirectoryAbi,
    functionName: 'keyHash',
    args: [address],
  })
  return keyHash as Hex
}

export async function getKey(client: ShieldedWalletClient): Promise<Hex> {
  const key = await signedReadContract(client, {
    address: DIRECTORY_ADDRESS,
    abi: DirectoryAbi,
    functionName: 'getKey',
  })
  return ('0x' + (key as bigint).toString(16).padStart(64, '0')) as Hex // TODO: shift to different function
}

export async function registerKey(
  client: ShieldedWalletClient,
  aesKey: Hex
): Promise<Hex> {
  const txPromise = shieldedWriteContract(client, {
    chain: client.chain,
    address: DIRECTORY_ADDRESS,
    abi: DirectoryAbi,
    functionName: 'setKey',
    args: [BigInt(aesKey)],
  })

  return withTimeout(txPromise, TX_TIMEOUT_MS)
}

export function computeKeyHash(aesKey: Hex): Hex {
  return keccak256(aesKey) as Hex
}
