import { expect } from 'bun:test'
import {
  AesGcmCrypto,
  createShieldedPublicClient,
  createShieldedWalletClient,
  randomEncryptionNonce,
} from 'seismic-viem'
import { Account, Chain } from 'viem'
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
  })

  const nonce = await publicClient.getTransactionCount({
    address: account.address,
  })

  const aesKey = walletClient.getEncryption()
  const aesCipher = new AesGcmCrypto(aesKey)

  const plaintextCalldata = '0x1234567890abcdef'
  const encryptionNonce = randomEncryptionNonce()
  const data = await aesCipher.encrypt(plaintextCalldata, encryptionNonce)

  const hash = await walletClient.sendShieldedTransaction({
    to: '0x0000000000000000000000000000000000000000',
    chain,
    data,
    value: 1n,
    encryptionPubkey: walletClient.getEncryptionPublicKey(),
    encryptionNonce,
    messageVersion: 0,
    gas: 30_000_000n,
    nonce,
  })

  await publicClient.waitForTransactionReceipt({ hash })
  const tx = await publicClient.getTransaction({ hash })
  expect(tx.input).toBe(data)
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
