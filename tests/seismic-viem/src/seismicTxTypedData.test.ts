import { afterAll, describe, test } from 'bun:test'
import { http } from 'viem'
import type { TransactionSerializableLegacy } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { anvil } from 'viem/chains'

import {
  SeismicTxExtras,
  TransactionSerializableSeismic,
  stringifyBigInt,
} from '@sviem/chain'
import { createShieldedWalletClient } from '@sviem/client'
import { signSeismicTxTypedData } from '@sviem/signSeismicTypedData'
import { setupAnvilNode } from '@test/process/chains/anvil'

// Running on a different port because contract.test.ts uses 8545
const { url, exitProcess } = await setupAnvilNode(8547, false)

const ENC_SK =
  '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'
const ENC_PK =
  '0x028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0'

const TEST_ACCOUNT_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const testAccount = privateKeyToAccount(TEST_ACCOUNT_PRIVATE_KEY)

const testSeismicTypedMsgSigning = async () => {
  const baseTx: TransactionSerializableLegacy = {
    nonce: 2,
    gasPrice: 1000000000n,
    gas: 100000n,
    to: '0xd3e8763675e4c425df46cc3b5c0f6cbdac396046',
    data: '0xfc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb875',
    value: 1000000000000000n,
    chainId: anvil.id,
  }

  const seismicExtras: SeismicTxExtras = {
    encryptionPubkey: ENC_PK,
  }

  const tx: TransactionSerializableSeismic = {
    from: testAccount.address,
    ...baseTx,
    ...seismicExtras,
  }

  const client = await createShieldedWalletClient({
    chain: anvil,
    account: testAccount,
    transport: http(url),
    encryptionSk: ENC_SK,
  })

  const { typedData, signature } = await signSeismicTxTypedData(client, tx)
  const result = await client.request({
    method: 'eth_call',
    params: [{ data: typedData, signature }],
  })

  console.log(JSON.stringify(result, stringifyBigInt, 2))
}

describe('Seismic Transaction Encoding', async () => {
  test('client can sign a seismic typed message', testSeismicTypedMsgSigning, {
    timeout: 20_000,
  })
})

afterAll(async () => {
  await exitProcess()
})
