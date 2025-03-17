import { afterAll, describe, expect, test } from 'bun:test'
import { http } from 'viem'
import type { TransactionSerializableLegacy } from 'viem'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { parseEther } from 'viem/utils'

import { envChain, setupNode } from '@sviem-tests/process/node.ts'
import { createShieldedWalletClient } from '@sviem/client.ts'
import { AesGcmCrypto } from '@sviem/crypto/aes.ts'
import { signSeismicTxTypedData } from '@sviem/signSeismicTypedData.ts'

// Running on a different port because contract.test.ts uses 8545
const chain = envChain()
const { url, exitProcess } = await setupNode(chain, {
  port: 8547,
  silent: true,
})

const ENC_SK =
  '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'
const ENC_PK =
  '0x028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0'

const TEST_ACCOUNT_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const testAccount = privateKeyToAccount(TEST_ACCOUNT_PRIVATE_KEY)

const recipientAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

const testSeismicCallTypedData = async () => {
  const client = await createShieldedWalletClient({
    chain,
    account: testAccount,
    transport: http(url),
    encryptionSk: ENC_SK,
  })

  const nonce = await client.getTransactionCount({
    address: testAccount.address,
  })

  const toShaHash = '0x68656c6c6f20776f726c64'
  const aes = new AesGcmCrypto(client.getEncryption())
  const encrypted = await aes.encrypt(toShaHash, nonce)

  const baseTx: TransactionSerializableLegacy = {
    nonce,
    to: '0x0000000000000000000000000000000000000002',
    data: encrypted,
    chainId: chain.id,
    type: 'legacy',
    gas: 30_000_000n,
  }
  const preparedTx = await client.prepareTransactionRequest(baseTx)
  const tx = { ...preparedTx, encryptionPubkey: ENC_PK }

  // @ts-ignore
  const { typedData, signature } = await signSeismicTxTypedData(client, tx)
  const ciphertext: Hex = await client.request({
    method: 'eth_call',
    params: [{ data: typedData, signature }],
  })

  const decrypted = await aes.decrypt(ciphertext, nonce)
  const expectedPlaintext =
    '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
  expect(decrypted).toBe(expectedPlaintext)
}

const testSeismicTxTypedData = async () => {
  const value = parseEther('1', 'wei')

  const client = await createShieldedWalletClient({
    chain,
    account: testAccount,
    transport: http(url),
    encryptionSk: ENC_SK,
  })

  const preTxBalance = await client.getBalance({ address: recipientAddress })

  const nonce = await client.getTransactionCount({
    address: testAccount.address,
  })
  const baseTx: TransactionSerializableLegacy = {
    to: recipientAddress,
    chainId: chain.id,
    type: 'legacy',
    gas: 100_000n,
    value,
    nonce,
  }
  const preparedTx = await client.prepareTransactionRequest(baseTx)
  const tx = { ...preparedTx, encryptionPubkey: ENC_PK }

  // @ts-ignore
  const { typedData, signature } = await signSeismicTxTypedData(client, tx)

  const hash: Hex = await client.request({
    method: 'eth_sendRawTransaction',
    params: [{ data: typedData, signature }],
  })
  await client.waitForTransactionReceipt({ hash })

  const postTxBalance = await client.getBalance({ address: recipientAddress })
  expect(postTxBalance).toBe(preTxBalance + value)
}

describe('Seismic Transaction Encoding', async () => {
  test('client can sign a seismic typed message', testSeismicCallTypedData, {
    timeout: 20_000,
  })

  test('client can sign via eth_signTypedData', testSeismicTxTypedData, {
    timeout: 20000,
  })
})

afterAll(async () => {
  await exitProcess()
})
