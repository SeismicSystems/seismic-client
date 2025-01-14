import { afterAll, describe, expect, test } from 'bun:test'
import { http } from 'viem'
import type { TransactionSerializable } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { prepareTransactionRequest } from 'viem/actions'
import { anvil } from 'viem/chains'

import { SeismicTxExtras, serializeSeismicTransaction } from '@sviem/chain'
import { createShieldedWalletClient } from '@sviem/client'
import { compressPublicKey } from '@sviem/crypto/secp'
import { setupAnvilNode } from '@test/process/chains/anvil'

const ENC_SK =
  '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'
const ENC_PK =
  '0x028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0'

const TEST_ACCOUNT_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const testAccount = privateKeyToAccount(TEST_ACCOUNT_PRIVATE_KEY)

// Running on a different port because contract.test.ts uses 8545
const { url, exitProcess } = await setupAnvilNode(8546)

const testSeismicTxEncoding = async () => {
  expect(ENC_PK).toBe(compressPublicKey(privateKeyToAccount(ENC_SK).publicKey))
  const tx: TransactionSerializable = {
    chainId: anvil.id,
    nonce: 2,
    gasPrice: 1000000000n,
    gas: 100000n,
    to: '0xd3e8763675e4c425df46cc3b5c0f6cbdac396046',
    value: 1000000000000000n,
  }

  const seismicExtras: SeismicTxExtras = {
    seismicInput:
      '0xfc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb875',
    encryptionPubkey: ENC_PK,
  }

  const client = await createShieldedWalletClient({
    chain: anvil,
    account: testAccount,
    transport: http(url),
    encryptionSk: ENC_SK,
  })
  const preparedTx = await prepareTransactionRequest(client, tx)
  const serializedTransaction = await testAccount!.signTransaction!(
    { ...seismicExtras, ...preparedTx },
    { serializer: serializeSeismicTransaction }
  )

  // const signature = {
  //   r: '0x1e7a28fd3647ab10173d940fe7e561f7b06185d3d6a93b83b2f210055dd27f04',
  //   s: '0x779d1157c4734323923df2f41073ecb016719a577ce774ef4478c9b443caacb3',
  //   v: '28',
  //   yParity: 1,
  // }

  const expected =
    '0x4af8d1827a6902843b9aca00830186a094d3e8763675e4c425df46cc3b5c0f6cbdac39604687038d7ea4c68000b840fc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb875a1028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a001a01e7a28fd3647ab10173d940fe7e561f7b06185d3d6a93b83b2f210055dd27f04a0779d1157c4734323923df2f41073ecb016719a577ce774ef4478c9b443caacb3'
  // @ts-ignore
  expect(serializedTransaction).toBe(expected)
}

describe('Seismic Transaction Encoding', async () => {
  test('node detects and parses seismic transaction', testSeismicTxEncoding, {
    timeout: 20_000,
  })
})

afterAll(async () => {
  await exitProcess()
})
