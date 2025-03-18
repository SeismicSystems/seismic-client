import { afterAll, beforeAll, describe, test } from 'bun:test'
import { Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { envChain, setupNode } from '@sviem-tests/process/node.ts'
import { testSeismicTx } from '@sviem-tests/tests/contract/contract.ts'
import { loadDotenv } from '@test/env.ts'

// This is the 1st private key Anvil provides under the mnemonic "test"*12
const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const account = privateKeyToAccount(TEST_PRIVATE_KEY)

let chain: Chain
let url: string
let exitProcess: () => Promise<void>

beforeAll(async () => {
  loadDotenv()
  chain = envChain()
  const node = await setupNode(chain)
  url = node.url
  exitProcess = node.exitProcess
})

describe('Seismic Contract', async () => {
  test(
    'deploy & call contracts with seismic tx',
    () => testSeismicTx({ chain, url, account }),
    {
      timeout: 20_000,
    }
  )
})

afterAll(async () => {
  await exitProcess()
})
