import { afterAll, beforeAll, describe, test } from 'bun:test'
import { Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import {
  buildNode,
  envChain,
  loadDotenv,
  setupNode,
  testSeismicTx,
} from '@sviem-tests/index.ts'
import { testAesKeygen } from '@sviem-tests/tests/aesKeygen.ts'
import { testSeismicTxEncoding } from '@sviem-tests/tests/encoding.ts'
import { testRng } from '@sviem-tests/tests/precompiles.ts'
import { testHkdfHex } from '@sviem-tests/tests/precompiles.ts'
import { testAesGcm } from '@sviem-tests/tests/precompiles.ts'
import { testSecp256k1 } from '@sviem-tests/tests/precompiles.ts'
import { testHkdfString } from '@sviem-tests/tests/precompiles.ts'
import { testEcdh } from '@sviem-tests/tests/precompiles.ts'
import { testRngWithPers } from '@sviem-tests/tests/precompiles.ts'
import {
  testLegacyTxTrace,
  testSeismicTxTrace,
} from '@sviem-tests/tests/trace.ts'
import {
  testSeismicCallTypedData,
  testSeismicTxTypedData,
} from '@sviem-tests/tests/typedData.ts'
import { testWsConnection } from '@sviem-tests/tests/ws.ts'

const TIMEOUT_MS = 20_000

const ENC_SK =
  '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'
const ENC_PK =
  '0x028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0'

const TEST_ACCOUNT_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const account = privateKeyToAccount(TEST_ACCOUNT_PRIVATE_KEY)

let chain: Chain
let url: string
let wsUrl: string
let port: number
let exitProcess: () => Promise<void>

beforeAll(async () => {
  loadDotenv()
  chain = envChain()
  port = 8545
  await buildNode(chain)
  const node = await setupNode(chain, {
    port,
    ws: true,
    // verbosity: 5,
    // silent: false,
  })
  exitProcess = node.exitProcess
  url = node.url
  wsUrl = `ws://localhost:${port}`
})

describe('Seismic Contract', async () => {
  test(
    'deploy & call contracts with seismic tx',
    async () => await testSeismicTx({ chain, url, account }),
    {
      timeout: TIMEOUT_MS,
    }
  )
})

describe('Seismic Transaction Encoding', async () => {
  test(
    'node detects and parses seismic transaction',
    async () =>
      await testSeismicTxEncoding({
        chain,
        account,
        url,
        encryptionSk: ENC_SK,
        encryptionPubkey: ENC_PK,
      }),
    {
      timeout: TIMEOUT_MS,
    }
  )
})

describe('Typed Data', async () => {
  test(
    'client can sign a seismic typed message',
    async () =>
      await testSeismicCallTypedData({
        chain,
        account,
        url,
        encryptionSk: ENC_SK,
        encryptionPubkey: ENC_PK,
      }),
    { timeout: TIMEOUT_MS }
  )

  test(
    'client can sign via eth_signTypedData',
    async () =>
      await testSeismicTxTypedData({
        account,
        chain,
        url,
        encryptionSk: ENC_SK,
        encryptionPubkey: ENC_PK,
      }),
    { timeout: TIMEOUT_MS }
  )
})

describe('AES', async () => {
  test('generates AES key correctly', testAesKeygen)
})

describe('Websocket Connection', () => {
  test(
    'should connect to the ws',
    async () => {
      await testWsConnection({
        chain,
        wsUrl,
      })
    },
    { timeout: TIMEOUT_MS }
  )
})

describe('Seismic Precompiles', () => {
  test(
    'RNG(1)',
    async () => {
      await testRng({ chain, url }, 1)
    },
    { timeout: TIMEOUT_MS }
  )
  test(
    'RNG(8)',
    async () => {
      await testRng({ chain, url }, 8)
    },
    { timeout: TIMEOUT_MS }
  )
  test(
    'RNG(32)',
    async () => {
      await testRng({ chain, url }, 32)
    },
    { timeout: TIMEOUT_MS }
  )
  test(
    'RNG(32, pers)',
    async () => {
      await testRngWithPers({ chain, url }, 32)
    },
    { timeout: TIMEOUT_MS }
  )
  test(
    'ECDH',
    async () => {
      await testEcdh({ chain, url })
    },
    { timeout: TIMEOUT_MS }
  )
  test(
    'HKDF(string)',
    async () => {
      await testHkdfString({ chain, url })
    },
    { timeout: TIMEOUT_MS }
  )
  test(
    'HKDF(hex)',
    async () => {
      await testHkdfHex({ chain, url })
    },
    { timeout: TIMEOUT_MS }
  )
  test('AES-GCM', async () => testAesGcm({ chain, url }), {
    timeout: TIMEOUT_MS,
  })
  test('secp256k1', async () => testSecp256k1({ chain, url }), {
    timeout: TIMEOUT_MS,
  })
})

describe('Transaction Trace', async () => {
  test(
    'Seismic Tx removes input from trace',
    async () => {
      await testSeismicTxTrace({ chain, url, account })
    },
    {
      timeout: TIMEOUT_MS,
    }
  )
  test(
    'Legacy Tx keeps input in trace',
    async () => {
      await testLegacyTxTrace({ chain, url, account })
    },
    { timeout: TIMEOUT_MS }
  )
})

afterAll(async () => {
  await exitProcess()
})
