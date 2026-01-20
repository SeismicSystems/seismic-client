import { expect } from 'bun:test'
import {
  buildTxSeismicMetadata,
  createShieldedWalletClient,
  encodeSeismicMetadataAsAAD,
  randomEncryptionNonce,
  signSeismicTxTypedData,
} from 'seismic-viem'
import { bytesToHex, http } from 'viem'
import type { Account, Chain, TransactionSerializableLegacy } from 'viem'
import type { Hex } from 'viem'
import { parseEther } from 'viem/utils'

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
  const to = '0x0000000000000000000000000000000000000004'
  const metadata = await buildTxSeismicMetadata(client, {
    account,
    nonce,
    to,
    encryptionNonce: randomEncryptionNonce(),
    signedRead: true,
    typedDataTx: true,
  })
  const encodedMetadata = bytesToHex(encodeSeismicMetadataAsAAD(metadata))
  const encrypted = await client.encrypt(plaintext, metadata)

  const baseTx: TransactionSerializableLegacy = {
    nonce,
    to,
    data: encrypted,
    chainId: chain.id,
    type: 'legacy',
    gas: 30_000_000n,
  }
  const preparedTx = await client.prepareTransactionRequest(baseTx)
  const tx = { ...preparedTx, ...metadata.seismicElements }

  // @ts-ignore
  const { typedData, signature } = await signSeismicTxTypedData(client, tx)
  const ciphertext: Hex = await client.request({
    method: 'eth_call',
    params: [{ data: typedData, signature }],
  })

  const decrypted = await client.decrypt(ciphertext, metadata)
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
  const metadata = await buildTxSeismicMetadata(client, {
    account,
    nonce,
    to: recipientAddress,
    value,
    encryptionNonce: randomEncryptionNonce(),
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
  const tx = { ...preparedTx, ...metadata.seismicElements }

  // @ts-ignore
  const { typedData, signature } = await signSeismicTxTypedData(client, tx)

  const hash: Hex = await client.request({
    method: 'eth_sendRawTransaction',
    params: [{ data: typedData, signature }],
  })

  const receipt = await client.waitForTransactionReceipt({ hash })
  expect(receipt.status).toBe('success')

  const postTxBalance = await client.getBalance({ address: recipientAddress })
  expect(postTxBalance).toBe(preTxBalance + value)
}
