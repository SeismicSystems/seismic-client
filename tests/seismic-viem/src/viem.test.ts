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
const testAccount = privateKeyToAccount(TEST_ACCOUNT_PRIVATE_KEY)

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
  console.log('buildNode finished')
  const node = await setupNode(chain, { port, ws: true })
  exitProcess = node.exitProcess
  url = node.url
  wsUrl = `ws://localhost:${port}`
  console.log('before all finished')
})

describe('Seismic Contract', async () => {
  test(
    'deploy & call contracts with seismic tx',
    () => testSeismicTx({ chain, url, account: testAccount }),
    {
      timeout: TIMEOUT_MS,
    }
  )
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
      timeout: TIMEOUT_MS,
    }
  )
})

describe('Typed Data', async () => {
  test(
    'client can sign a seismic typed message',
    () =>
      testSeismicCallTypedData({
        chain,
        account: testAccount,
        url,
        encryptionSk: ENC_SK,
        encryptionPubkey: ENC_PK,
      }),
    { timeout: TIMEOUT_MS }
  )

  test(
    'client can sign via eth_signTypedData',
    () =>
      testSeismicTxTypedData({
        account: testAccount,
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

describe('Seismic Precompiles', async () => {
  test('RNG(1)', () => testRng({ chain, url }, 1), { timeout: TIMEOUT_MS })
  test('RNG(8)', () => testRng({ chain, url }, 8), { timeout: TIMEOUT_MS })
  test('RNG(16)', () => testRng({ chain, url }, 16), { timeout: TIMEOUT_MS })
  test('RNG(32)', () => testRng({ chain, url }, 32), { timeout: TIMEOUT_MS })
  test('RNG(32, pers)', () => testRngWithPers({ chain, url }, 32), {
    timeout: TIMEOUT_MS,
  })
  test('ECDH', () => testEcdh({ chain, url }), { timeout: TIMEOUT_MS })
  test('HKDF(string)', () => testHkdfString({ chain, url }), {
    timeout: TIMEOUT_MS,
  })
  test('HKDF(hex)', () => testHkdfHex({ chain, url }), { timeout: TIMEOUT_MS })
  test('AES-GCM', () => testAesGcm({ chain, url }), { timeout: TIMEOUT_MS })
  test('secp256k1', () => testSecp256k1({ chain, url }), {
    timeout: TIMEOUT_MS,
  })
})

afterAll(async () => {
  await exitProcess()
})
