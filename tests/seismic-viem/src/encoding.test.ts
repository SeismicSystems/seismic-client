import { afterAll, describe, expect, test } from 'bun:test'
import type { Hex, Signature, TransactionSerializable } from 'viem'

import { serializeSeismicTransaction } from '@sviem/chain'

const testSeismicTxEncoding = () => {
  const tx: TransactionSerializable & { seismicInput: Hex } = {
    chainId: 4,
    nonce: 2,
    gasPrice: 1000000000n,
    gas: 100000n,
    to: '0xd3e8763675e4c425df46cc3b5c0f6cbdac396046',
    value: 1000000000000000n,
    seismicInput:
      '0xfc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb875',
  }
  const signature: Signature = {
    r: '0xeb96ca19e8a77102767a41fc85a36afd5c61ccb09911cec5d3e86e193d9c5ae',
    s: '0x3a456401896b1b6055311536bf00a718568c744d8c1f9df59879e8350220ca18',
    yParity: 0,
  }
  const serialized = serializeSeismicTransaction(tx, signature)

  const expected =
    '0x4af8ad0402843b9aca00830186a094d3e8763675e4c425df46cc3b5c0f6cbdac39604687038d7ea4c68000b840fc3c2cf4943c327f19af0efaf3b07201f608dd5c8e3954399a919b72588d3872b6819ac3d13d3656cbb38833a39ffd1e73963196a1ddfa9e4a5d595fdbebb87580a00eb96ca19e8a77102767a41fc85a36afd5c61ccb09911cec5d3e86e193d9c5aea03a456401896b1b6055311536bf00a718568c744d8c1f9df59879e8350220ca18'
  expect(serialized).toBe(expected)
}

describe('Seismic Transaction Encoding', async () => {
  test('node detects and parses seismic transaction', testSeismicTxEncoding, {
    timeout: 20_000,
  })
})
