import { afterAll, beforeAll, describe, test } from 'bun:test'
import { Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { envChain, setupNode } from '@sviem-tests/process/node.ts'
import { testSeismicTxEncoding } from '@sviem-tests/tests/encoding.ts'
import { loadDotenv } from '@test/env.ts'

const ENC_SK =
  '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'
const ENC_PK =
  '0x028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0'

const TEST_ACCOUNT_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const testAccount = privateKeyToAccount(TEST_ACCOUNT_PRIVATE_KEY)

let chain: Chain
let url: string
let exitProcess: () => Promise<void>

beforeAll(async () => {
  loadDotenv()
  chain = envChain()
  const node = await setupNode(chain, {
    port: 8546,
    silent: true,
  })
  url = node.url
  exitProcess = node.exitProcess
})

describe('Seismic Transaction Encoding', async () => {
  test(
    'node detects and parses seismic transaction',
    () =>
      testSeismicTxEncoding({
        chain,
        account: testAccount,
        url,
        encryptionSk: ENC_SK,
        encryptionPubkey: ENC_PK,
      }),
    {
      timeout: 20_000,
    }
  )
})

afterAll(async () => {
  await exitProcess()
})

// 0xf89c
// 827a69
// 02843b9aca00830186a094d3e8763675e4c425df46cc3b5c0f6cbdac39604687038d7ea4c68000a1028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a08cbe038ada26fea4ebcb4a610780b840fc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb875
