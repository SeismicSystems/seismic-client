import { expect } from 'bun:test'
import { createShieldedWalletClient } from 'seismic-viem'
import { AesGcmCrypto } from 'seismic-viem'
import { signSeismicTxTypedData } from 'seismic-viem'
import { http } from 'viem'
import type { Account, Chain, TransactionSerializableLegacy } from 'viem'
import type { Hex } from 'viem'
import { parseEther } from 'viem/utils'

import { randomEncryptionNonce } from '../../../seismic-viem/src/crypto/nonce.ts'

type TestSeismicCallTypeDataArgs = {
  chain: Chain
  account: Account
  url: string
  encryptionSk: Hex
  encryptionPubkey: Hex
}

export const testSeismicCallTypedData = async ({
  chain,
  account,
  url,
  encryptionSk,
  encryptionPubkey,
}: TestSeismicCallTypeDataArgs) => {
  const client = await createShieldedWalletClient({
    chain,
    account,
    transport: http(url),
    encryptionSk,
  })

  const nonce = await client.getTransactionCount({
    address: account.address,
  })

  const plaintext = '0x68656c6c6f20776f726c64'
  const aes = new AesGcmCrypto(client.getEncryption())
  const encryptionNonce = randomEncryptionNonce()
  console.log('encryptionNonce', encryptionNonce)
  const encrypted = await aes.encrypt(plaintext, encryptionNonce)

  const baseTx: TransactionSerializableLegacy = {
    nonce,
    to: '0x0000000000000000000000000000000000000004',
    data: encrypted,
    chainId: chain.id,
    type: 'legacy',
    gas: 30_000_000n,
  }
  const preparedTx = await client.prepareTransactionRequest(baseTx)
  const tx = { ...preparedTx, encryptionPubkey, encryptionNonce }

  // @ts-ignore
  const { typedData, signature } = await signSeismicTxTypedData(client, tx)
  const ciphertext: Hex = await client.request({
    method: 'eth_call',
    params: [{ data: typedData, signature }],
  })

  const decrypted = await aes.decrypt(ciphertext, encryptionNonce)
  console.log('decrypted', decrypted)
  expect(decrypted).toBe(plaintext)
}

export const testSeismicTxTypedData = async ({
  account,
  chain,
  url,
  encryptionSk,
  encryptionPubkey,
}: TestSeismicCallTypeDataArgs) => {
  const recipientAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  const value = parseEther('1', 'wei')

  const client = await createShieldedWalletClient({
    chain,
    account,
    transport: http(url),
    encryptionSk,
  })

  const preTxBalance = await client.getBalance({ address: recipientAddress })

  const nonce = await client.getTransactionCount({
    address: account.address,
  })
  const encryptionNonce = randomEncryptionNonce()
  const baseTx: TransactionSerializableLegacy = {
    to: recipientAddress,
    chainId: chain.id,
    type: 'legacy',
    gas: 100_000n,
    value,
    nonce,
  }
  const preparedTx = await client.prepareTransactionRequest(baseTx)
  const tx = { ...preparedTx, encryptionPubkey, encryptionNonce }

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
