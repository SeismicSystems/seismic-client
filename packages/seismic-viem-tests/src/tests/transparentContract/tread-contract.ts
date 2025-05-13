import { expect } from 'bun:test'
import {
  createShieldedPublicClient,
  createShieldedWalletClient,
} from 'seismic-viem'
import { getShieldedContract } from 'seismic-viem'
import { http } from 'viem'
import { readContract } from 'viem/actions'

import type { ContractTestArgs } from '@sviem-tests/tests/contract/contract.ts'
import { transparentCounterABI } from '@sviem-tests/tests/transparentContract/abi.ts'
import { transparentCounterBytecode } from '@sviem-tests/tests/transparentContract/bytecode.ts'

const treadSetup = async ({ chain, url, account }: ContractTestArgs) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
  const walletClient = await createShieldedWalletClient({
    chain,
    transport: http(url),
    account,
  })
  const testContractBytecodeFormatted: `0x${string}` = `0x${transparentCounterBytecode.object.replace(/^0x/, '')}`

  const deployTx = await walletClient.deployContract({
    abi: transparentCounterABI,
    bytecode: testContractBytecodeFormatted,
    chain: walletClient.chain,
  })
  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployTx,
  })

  const deployedContractAddress = deployReceipt.contractAddress!
  return {
    deployedContractAddress,
    publicClient,
    walletClient,
  }
}

export const testContractTreadIsntSeismicTx = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const { deployedContractAddress, publicClient, walletClient } =
    await treadSetup({ chain, url, account })

  const seismicContract = getShieldedContract({
    abi: transparentCounterABI,
    address: deployedContractAddress,
    client: walletClient,
  })

  const isOdd = await seismicContract.tread.isOdd()
  expect(isOdd).toBe(false)
}

export const testViemReadContractIsntSeismicTx = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const { deployedContractAddress, publicClient, walletClient } =
    await treadSetup({ chain, url, account })

  const isOdd = await readContract(walletClient, {
    address: deployedContractAddress,
    abi: transparentCounterABI,
    functionName: 'isOdd',
  })
  expect(isOdd).toBe(false)
}

export const testShieldedWalletClientTreadIsntSeismicTx = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const { deployedContractAddress, publicClient, walletClient } =
    await treadSetup({ chain, url, account })

  const isOdd = await walletClient.treadContract({
    address: deployedContractAddress,
    abi: transparentCounterABI,
    functionName: 'isOdd',
  })
  expect(isOdd).toBe(false)
}
