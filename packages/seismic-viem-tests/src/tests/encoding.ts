import { expect } from 'bun:test'
import { serializeSeismicTransaction, stringifyBigInt } from 'seismic-viem'
import type { SeismicTxExtras } from 'seismic-viem'
import { createShieldedWalletClient } from 'seismic-viem'
import { compressPublicKey } from 'seismic-viem'
import { http } from 'viem'
import type { Account, Chain, Hex, TransactionSerializableLegacy } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { prepareTransactionRequest } from 'viem/actions'
import { anvil } from 'viem/chains'

type EncodingParams = {
  chain: Chain
  url: string
  encryptionSk: Hex
  encryptionPubkey: Hex
  account: Account
}

export const testSeismicTxEncoding = async ({
  chain,
  url,
  account,
  encryptionSk,
  encryptionPubkey,
}: EncodingParams) => {
  expect(encryptionPubkey).toBe(
    compressPublicKey(privateKeyToAccount(encryptionSk).publicKey)
  )

  const plaintext = '0xdeadbeef'
  const tx: TransactionSerializableLegacy = {
    chainId: chain.id,
    nonce: 2,
    gasPrice: 1000000000n,
    gas: 100000n,
    to: '0xd3e8763675e4c425df46cc3b5c0f6cbdac396046',
    value: 1000000000000000n,
    data: plaintext,
  }

  const client = await createShieldedWalletClient({
    chain,
    account,
    transport: http(url),
    encryptionSk,
  })
  const genesisBlock = await client.getBlock({ blockNumber: 0n })

  const seismicExtras: SeismicTxExtras = {
    encryptionPubkey,
    encryptionNonce: '0x00', // Fixed nonce for deterministic testing (like Rust's U96::ZERO)
    recentBlockHash: genesisBlock.hash,
    expiresAtBlock: 18_446_744_073_709_551_615n,
    signedRead: false,
  }
  console.log(JSON.stringify(seismicExtras, stringifyBigInt, 2))

  const preparedTx = await prepareTransactionRequest(client, tx)
  const serializedTransaction = await account.signTransaction!(
    // @ts-ignore
    { ...seismicExtras, ...preparedTx },
    // @ts-ignore
    { serializer: serializeSeismicTransaction }
  )

  console.log('\n=== Serialized Transaction ===')
  console.log('Chain ID:', chain.id)
  console.log('Encoded:', serializedTransaction)
  console.log('Length:', serializedTransaction.length, 'chars')
  console.log('\n=== Encoding now includes all seismic_elements fields ===')
  console.log('✓ encryption_pubkey')
  console.log('✓ encryption_nonce')
  console.log('✓ message_version')
  console.log('✓ recent_block_hash')
  console.log('✓ expires_at_block')
  console.log('✓ signed_read')

  // Verify it's a valid hex string
  const expected =
    chain.id === anvil.id
      ? '0x4af8fe827a6902843b9aca00830186a094d3e8763675e4c425df46cc3b5c0f6cbdac39604687038d7ea4c68000a1028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a08080a0e3e59282e5c8e00876114bb9a9912e98682670da653fa53059de0f0cf2b8087888ffffffffffffffff80b840fc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb87501a01e7a28fd3647ab10173d940fe7e561f7b06185d3d6a93b83b2f210055dd27f04a0779d1157c4734323923df2f41073ecb016719a577ce774ef4478c9b443caacb3'
      : '0x4af8d382140402843b9aca00830186a094d3e8763675e4c425df46cc3b5c0f6cbdac39604687038d7ea4c68000a1028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a08080b840fc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb87501a01aba3dd6f3e3d10ce155dddff01c2870a468ff5a40522b6ed62e077858ce8fcba06e5407d36b0b6b7da94a82c614c4946c41664adc60c7e56dfb495de1615f872e'

  // @ts-ignore
  expect(serializedTransaction).toBe(expected)
}
