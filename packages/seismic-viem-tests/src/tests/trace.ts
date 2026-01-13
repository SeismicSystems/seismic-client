import { expect } from 'bun:test'
import {
  buildTxSeismicMetadata,
  createShieldedPublicClient,
  createShieldedWalletClient,
  encodeSeismicMetadataAsAAD,
} from 'seismic-viem'
import { Account, Chain, bytesToHex } from 'viem'
import { http } from 'viem'

type ContractTestArgs = {
  chain: Chain
  url: string
  account: Account
}

export const testSeismicTxTrace = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
  const walletClient = await createShieldedWalletClient({
    chain,
    transport: http(url),
    account,
    encryptionSk:
      '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505',
  })

  const nonce = await publicClient.getTransactionCount({
    address: account.address,
  })
  const plaintextCalldata = '0xdeadbeef'
  const to = '0x0000000000000000000000000000000000000000'
  const value = 1n
  const encryptionNonce = '0xffffffffffffffffffffffff'
  const metadata = await buildTxSeismicMetadata(walletClient, {
    account,
    nonce,
    to,
    value,
    encryptionNonce,
  })
  const encodedMetadata = bytesToHex(encodeSeismicMetadataAsAAD(metadata))
  const encryptedCalldata = await walletClient.encrypt(
    plaintextCalldata,
    metadata
  )
  const hash = await walletClient.sendShieldedTransaction(
    {
      to,
      chain,
      data: plaintextCalldata,
      value,
      gas: 30_000_000n,
      gasPrice: 10_000_000_000n,
      nonce,
    },
    { encryptionNonce }
  )

  await publicClient.waitForTransactionReceipt({ hash })
  const tx = await publicClient.getTransaction({ hash })
  expect(tx.input).toBe(encryptedCalldata)
}

export const testLegacyTxTrace = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
  const walletClient = await createShieldedWalletClient({
    chain,
    transport: http(url),
    account,
  })

  const nonce = await publicClient.getTransactionCount({
    address: account.address,
  })

  const data = '0x1234567890abcdef'

  const hash = await walletClient.sendTransaction({
    to: '0x0000000000000000000000000000000000000000',
    chain,
    data,
    value: 1n,
    messageVersion: 0,
    gas: 30_000_000n,
    nonce,
  })

  await publicClient.waitForTransactionReceipt({ hash })
  const tx = await publicClient.getTransaction({ hash })
  expect(tx.input).toBe(data)
}
