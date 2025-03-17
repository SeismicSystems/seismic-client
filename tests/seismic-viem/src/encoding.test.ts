import { afterAll, describe, test } from 'bun:test'
import { privateKeyToAccount } from 'viem/accounts'

import { envChain, setupNode } from '@sviem/process/node.ts'
import { testSeismicTxEncoding } from '@sviem/tests/encoding.ts'

const ENC_SK =
  '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'
const ENC_PK =
  '0x028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0'

const TEST_ACCOUNT_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const testAccount = privateKeyToAccount(TEST_ACCOUNT_PRIVATE_KEY)

// Running on a different port because contract.test.ts uses 8545
const chain = envChain()
const { url, exitProcess } = await setupNode(chain, {
  port: 8546,
  silent: true,
})

describe('Seismic Transaction Encoding', async () => {
  test(
    'node detects and parses seismic transaction',
    () =>
      testSeismicTxEncoding({
        chain,
        account: testAccount,
        url,
        exitProcess,
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
