import { expect } from 'bun:test'
import {
  createShieldedPublicClient,
  createShieldedWalletClient,
} from 'seismic-viem'
import { SEISMIC_TX_TYPE, getShieldedContract } from 'seismic-viem'
import { Hex, hexToNumber } from 'viem'
import { http } from 'viem'
import { writeContract } from 'viem/actions'

import type { ContractTestArgs } from '@sviem-tests/tests/contract/contract.ts'
import { transparentCounterABI } from '@sviem-tests/tests/transparentContract/abi.ts'
import { transparentCounterBytecode } from '@sviem-tests/tests/transparentContract/bytecode.ts'

const TEST_NUMBER = BigInt(11)

const twriteSetup = async ({ chain, url, account }: ContractTestArgs) => {
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

const expectNonSeismicTx = (typeHex: Hex | null) => {
  if (!typeHex) {
    throw new Error('Transaction type not found')
  } else {
    const txType = hexToNumber(typeHex)
    expect(txType).not.toBe(SEISMIC_TX_TYPE)
  }
}

export const testContractTwriteIsntSeismicTx = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const { deployedContractAddress, publicClient, walletClient } =
    await twriteSetup({ chain, url, account })

  const seismicContract = getShieldedContract({
    abi: transparentCounterABI,
    address: deployedContractAddress,
    client: walletClient,
  })

  const hash = await seismicContract.twrite.setNumber([TEST_NUMBER])
  const { typeHex } = await publicClient.getTransaction({ hash })
  expectNonSeismicTx(typeHex)
}

export const testViemWriteContractIsntSeismicTx = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const { deployedContractAddress, publicClient, walletClient } =
    await twriteSetup({ chain, url, account })

  const hash = await writeContract(walletClient, {
    address: deployedContractAddress,
    abi: transparentCounterABI,
    functionName: 'setNumber',
    args: [TEST_NUMBER],
  })
  const { typeHex } = await publicClient.getTransaction({ hash })
  expectNonSeismicTx(typeHex)
}

export const testShieldedWalletClientTwriteIsntSeismicTx = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const { deployedContractAddress, publicClient, walletClient } =
    await twriteSetup({ chain, url, account })

  const hash = await walletClient.twriteContract({
    address: deployedContractAddress,
    abi: transparentCounterABI,
    functionName: 'setNumber',
    args: [TEST_NUMBER],
  })
  const { typeHex } = await publicClient.getTransaction({ hash })
  expectNonSeismicTx(typeHex)
}
