import type { Abi, ExtractAbiFunctionNames } from 'abitype'
import { expect } from 'bun:test'
import { Account, Chain } from 'viem'
import { http } from 'viem'

import {
  createShieldedPublicClient,
  createShieldedWalletClient,
} from '@sviem/client.ts'
import { getShieldedContract } from '@sviem/contract/contract.ts'
import { stringifyBigInt } from '@sviem/utils.ts'

type ContractTestArgs = {
  chain: Chain
  url: string
  account: Account
}
export const contractABI = [
  {
    type: 'function',
    name: 'increment',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isOdd',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setNumber',
    inputs: [{ name: 'newNumber', type: 'suint256', internalType: 'suint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const satisfies Abi

export const bytecode = {
  object:
    '0x6080604052348015600f57600080fd5b506101598061001f6000396000f3fe6080604052348015600f57600080fd5b5060043610603c5760003560e01c806324a7f0b714604157806343bd0d70146053578063d09de08a14606d575b600080fd5b6051604c366004609e565b6000b1565b005b60596073565b604051901515815260200160405180910390f35b6051608a565b600060026000b06082919060b6565b600114905090565b600080b0908060978360d7565b919050b150565b60006020828403121560af57600080fd5b5035919050565b60008260d257634e487b7160e01b600052601260045260246000fd5b500690565b60006001820160f657634e487b7160e01b600052601160045260246000fd5b506001019056fea26469706673582212206c8d0b6848aef0a4ceb33182854a75dcd854a9740ac84abe06feaaa63d3f96c164736f6c637828302e382e32382d646576656c6f702e323032342e31322e352b636f6d6d69742e39383863313261660059',
  sourceMap: '65:279:25:-:0;;;;;;;;;;;;;;;;;;;',
  linkReferences: {},
}

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

  const { txHash: tx2, ...debug } = await seismicContract.dwrite.increment()
  console.info(`[2] Incremented number in tx: ${tx2}`)
  console.info(`dwrite: ${JSON.stringify(debug, stringifyBigInt, 2)}`)
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

  type AbiFunctionNames = ExtractAbiFunctionNames<
    typeof contractABI,
    'pure' | 'view'
  >

  // Use non-explicit signed-read
  const isOdd3 = await seismicContract.tread.isOdd({
    account: account.address,
  })
  // number has been set back to 11
  expect(isOdd3).toBe(true)
}
