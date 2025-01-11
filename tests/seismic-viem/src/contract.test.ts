import { afterAll, describe, expect, test } from 'bun:test'
import { http } from 'viem'
import { parseGwei } from 'viem/utils'

import {
  createShieldedPublicClient,
  createShieldedWalletClient,
} from '@sviem/client'
import { getShieldedContract } from '@sviem/contract/contract'
import { contractABI } from '@test/contract/abi'
import { bytecode } from '@test/contract/bytecode'
import { loadDotenv } from '@test/env'
import { envChain, setupNode } from '@test/process/node'
import { getDeployedAddress, stringifyBigInt } from '@test/utils'

/* Test Contract:
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract SeismicCounter {
    suint256 number;

    function setNumber(suint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }

    function isOdd() public view returns (bool) {
        return number % 2 == 1;
    }
}
*/

loadDotenv()
const chain = envChain()

// This is the 1st private key Anvil provides under the mnemonic "test"*12
const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

const { url, exitProcess } = await setupNode(chain)

await new Promise((resolve) => setTimeout(resolve, 2000))

const transport = http(url)
const publicClient = createShieldedPublicClient({ chain, transport })
const walletClient = await createShieldedWalletClient({
  chain,
  transport,
  privateKey: TEST_PRIVATE_KEY,
})

const testContractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`
const TEST_NUMBER = BigInt(11)

const textSeismicTx = async () => {
  const deployTx = await walletClient.deployContract({
    abi: contractABI,
    bytecode: testContractBytecodeFormatted,
  })
  await publicClient.waitForTransactionReceipt({ hash: deployTx })

  const deployedContractAddress = await getDeployedAddress(
    publicClient,
    walletClient.account.address
  )
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
  // const isOdd0 = await seismicContract.read.isOdd()
  // contract initializes number to be 0
  expect(isOdd0).toBe(false)
  console.info(`[0] initial value of isOdd = ${isOdd0}`)

  // ============================================================
  // // This is a seismic tx since the arg to setNumber is an suint
  // const tx1 = await seismicContract.write.setNumber([TEST_NUMBER], {
  //   gas: 210000n,
  //   gasPrice: parseGwei('20'),
  //   nonce: 1,
  // })
  // console.info(`[1] Set number tx: ${tx1}`)
  // const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 })
  // console.info(
  //   `[1] setNumber receipt: ${JSON.stringify(receipt1, stringifyBigInt, 2)}`
  // )

  // // Try reading using explicit signedRead
  // const isOdd1 = await seismicContract.sread.isOdd()
  // // number has been set to 11
  // expect(isOdd1).toBe(true)

  // // Not a seismic tx since there are no arguments therefore no shielded arguments
  // const tx2 = await seismicContract.write.increment([], {
  //   gas: 210000n,
  //   gasPrice: parseGwei('20'),
  //   nonce: 2,
  // })
  // console.info(`[2] Incremented number in tx: ${tx2}`)
  // const receipt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 })
  // console.info(
  //   `[2] Increment receipt: ${JSON.stringify(receipt2, stringifyBigInt, 2)}`
  // )

  // // Try reading using unsigned (normal) read
  // const isOdd2 = await seismicContract.read.isOdd()
  // expect(isOdd2).toBe(false)

  // // This is a seismic tx since the arg to setNumber is an suint
  // const tx3 = await seismicContract.write.setNumber([TEST_NUMBER], {
  //   gas: 210000n,
  //   gasPrice: parseGwei('20'),
  //   nonce: 3,
  // })
  // console.info(`[3] Set number tx: ${tx1}`)
  // const receipt3 = await publicClient.waitForTransactionReceipt({ hash: tx3 })
  // console.info(
  //   `[3] setNumber receipt: ${JSON.stringify(receipt3, stringifyBigInt, 2)}`
  // )

  // // Use non-explicit signed-read
  // const isOdd3 = await seismicContract.read.isOdd([], {
  //   account: walletClient.account.address,
  // })
  // // number has been set back to 11
  // expect(isOdd3).toBe(true)
}

describe('Seismic Transaction', async () => {
  test('node detects and parses seismic transaction', textSeismicTx, {
    timeout: 20_000,
  })
})

afterAll(async () => {
  await exitProcess(0)
})
