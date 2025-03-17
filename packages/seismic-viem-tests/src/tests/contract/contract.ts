import { expect } from 'bun:test'
import {
  createShieldedPublicClient,
  createShieldedWalletClient,
  getShieldedContract,
  stringifyBigInt,
} from 'seismic-viem'
import { Account, Chain } from 'viem'
import { http } from 'viem'

import { contractABI } from '@sviem-tests/tests/contract/abi.ts'
import { bytecode } from '@sviem-tests/tests/contract/bytecode.ts'

type ContractTestArgs = {
  chain: Chain
  url: string
  account: Account
}

export const testSeismicTx = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
  const walletClient = await createShieldedWalletClient({
    chain,
    transport: http(url),
    account,
  })
  const testContractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`
  const TEST_NUMBER = BigInt(11)

  const deployTx = await walletClient.deployContract({
    abi: contractABI,
    bytecode: testContractBytecodeFormatted,
    chain: walletClient.chain,
  })
  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployTx,
  })

  const deployedContractAddress = deployReceipt.contractAddress!
  console.info(`Deployed contract address: ${deployedContractAddress}`)

  const seismicContract = getShieldedContract({
    abi: contractABI,
    address: deployedContractAddress,
    client: walletClient,
  })

  const isOdd0 = await walletClient.readContract({
    address: deployedContractAddress,
    abi: contractABI,
    functionName: 'isOdd',
  })
  // contract initializes number to be 0
  expect(isOdd0).toBe(false)
  console.info(`[0] initial value of isOdd = ${isOdd0}`)

  const tx1 = await seismicContract.write.setNumber([TEST_NUMBER])
  console.info(`[1] Set number tx: ${tx1}`)
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 })
  console.info(
    `[1] setNumber receipt: ${JSON.stringify(receipt1, stringifyBigInt, 2)}`
  )

  // Try reading using explicit signedRead
  const isOdd1 = await seismicContract.read.isOdd()
  // number has been set to 11
  expect(isOdd1).toBe(true)

  const tx2 = await seismicContract.write.increment()
  console.info(`[2] Incremented number in tx: ${tx2}`)
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 })
  console.info(
    `[2] Increment receipt: ${JSON.stringify(receipt2, stringifyBigInt, 2)}`
  )

  // Try reading using unsigned (normal) read
  const isOdd2 = await seismicContract.tread.isOdd()
  expect(isOdd2).toBe(false)

  const tx3 = await seismicContract.write.setNumber([TEST_NUMBER])
  console.info(`[3] Set number tx: ${tx1}`)
  const receipt3 = await publicClient.waitForTransactionReceipt({ hash: tx3 })
  console.info(
    `[3] setNumber receipt: ${JSON.stringify(receipt3, stringifyBigInt, 2)}`
  )

  // Use non-explicit signed-read
  const isOdd3 = await seismicContract.tread.isOdd([], {
    account: walletClient.account.address,
  })
  // number has been set back to 11
  expect(isOdd3).toBe(true)
}
