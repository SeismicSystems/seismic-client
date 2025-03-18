import { expect } from 'bun:test'
import { serializeSeismicTransaction } from 'seismic-viem'
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
  const tx: TransactionSerializableLegacy = {
    chainId: chain.id,
    nonce: 2,
    gasPrice: 1000000000n,
    gas: 100000n,
    to: '0xd3e8763675e4c425df46cc3b5c0f6cbdac396046',
    value: 1000000000000000n,
    data: '0xfc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb875',
  }

  const seismicExtras: SeismicTxExtras = {
    encryptionPubkey,
  }

  const client = await createShieldedWalletClient({
    chain,
    account,
    transport: http(url),
    encryptionSk,
  })
  const preparedTx = await prepareTransactionRequest(client, tx)
  const serializedTransaction = await account.signTransaction!(
    // @ts-ignore
    { ...seismicExtras, ...preparedTx },
    // @ts-ignore
    { serializer: serializeSeismicTransaction }
  )

  // const signature = {
  //   r: '0x1e7a28fd3647ab10173d940fe7e561f7b06185d3d6a93b83b2f210055dd27f04',
  //   s: '0x779d1157c4734323923df2f41073ecb016719a577ce774ef4478c9b443caacb3',
  //   v: '28',
  //   yParity: 1,
  // }

  const expected =
    chain.id === anvil.id
      ? '0x4af8d3827a6902843b9aca00830186a094d3e8763675e4c425df46cc3b5c0f6cbdac39604687038d7ea4c68000a1028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a08080b840fc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb87501a0b70db080d153599a2b537e354a153202cacc3f8c702f84b16a9eb7c8ca9fc044a00c5e4dfcb38d6ae69b155a9e2e2a6ef2e0924d92a7607f7bca667aab8bc51f09'
      : '0x4af8d382140402843b9aca00830186a094d3e8763675e4c425df46cc3b5c0f6cbdac39604687038d7ea4c68000a1028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a08080b840fc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb87501a01aba3dd6f3e3d10ce155dddff01c2870a468ff5a40522b6ed62e077858ce8fcba06e5407d36b0b6b7da94a82c614c4946c41664adc60c7e56dfb495de1615f872e'
  // @ts-ignore
  expect(serializedTransaction).toBe(expected)
}
