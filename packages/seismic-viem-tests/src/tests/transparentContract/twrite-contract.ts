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
import { contractABI } from '@sviem-tests/tests/transparentContract/abi.ts'
import { bytecode } from '@sviem-tests/tests/transparentContract/bytecode.ts'

/* Test Contract:
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

contract NormalCounter {
    uint256 number;

    function setNumber(uint256 newNumber) public {
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
  const testContractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`

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
    expect(txType).toBe(SEISMIC_TX_TYPE)
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
    abi: contractABI,
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
    abi: contractABI,
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
    abi: contractABI,
    functionName: 'setNumber',
    args: [TEST_NUMBER],
  })
  const { typeHex } = await publicClient.getTransaction({ hash })
  expectNonSeismicTx(typeHex)
}
