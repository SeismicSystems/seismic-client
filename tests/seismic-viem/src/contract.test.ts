import { afterAll, describe, test } from 'bun:test'
import { http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { envChain, setupNode } from '@sviem-tests/process/node.ts'
import { testSeismicTx } from '@sviem-tests/tests/contract/contract.ts'
import {
  createShieldedPublicClient,
  createShieldedWalletClient,
} from '@sviem/client.ts'
import { loadDotenv } from '@test/env.ts'

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
const account = privateKeyToAccount(TEST_PRIVATE_KEY)

const { url, exitProcess } = await setupNode(chain)

const transport = http(url)
const publicClient = await createShieldedPublicClient({ chain, transport })
const walletClient = await createShieldedWalletClient({
  chain,
  transport,
  account,
})

describe('Seismic Contract', async () => {
  test(
    'deploy & call contracts with seismic tx',
    () => testSeismicTx({ publicClient, walletClient }),
    {
      timeout: 20_000,
    }
  )
})

afterAll(async () => {
  await exitProcess()
})
