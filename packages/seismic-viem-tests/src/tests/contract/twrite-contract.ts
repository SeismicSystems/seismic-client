import { expect } from 'bun:test'
import {
  createShieldedPublicClient,
  createShieldedWalletClient,
} from 'seismic-viem'
import { SEISMIC_TX_TYPE, getShieldedContract } from 'seismic-viem'
import { Account, Chain, hexToNumber } from 'viem'
import { http } from 'viem'

import { contractABI } from '@sviem-tests/tests/contract/abi.ts'
import { bytecode } from '@sviem-tests/tests/contract/bytecode.ts'

type ContractTestArgs = {
  chain: Chain
  url: string
  account: Account
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

export const testTwriteIsntSeismicTx = async ({
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

  const hash = await seismicContract.twrite.setNumber([TEST_NUMBER])
  const { typeHex } = await publicClient.getTransaction({ hash })
  if (!typeHex) {
    throw new Error('Transaction type not found')
  } else {
    const txType = hexToNumber(typeHex)
    expect(txType).toBe(SEISMIC_TX_TYPE)
  }
}
