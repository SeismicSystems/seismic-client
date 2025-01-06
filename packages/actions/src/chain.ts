import {
  concatHex,
  defineChain,
  serializeTransaction,
  toHex,
  toRlp,
} from 'viem'
import type { Hex, Signature, TransactionSerializable } from 'viem'

import { toYParitySignatureArray } from '@actions/viem-internal/signature'

export const serializeSeismicTransaction = (
  transaction: TransactionSerializable & { seismicInput?: Hex | undefined },
  signature?: Signature
) => {
  // should be a better way to decide this...
  if (!transaction.seismicInput) {
    return serializeTransaction(
      transaction as TransactionSerializable,
      signature
    )
  }

  const {
    chainId,
    nonce,
    gasPrice,
    gas,
    to,
    value = 0n,
    seismicInput,
  } = transaction

  if (!chainId) {
    throw new Error('Seismic transactions require chainId argument')
  }

  const rlpEncoded = toRlp([
    toHex(chainId),
    nonce ? toHex(nonce) : '0x',
    gasPrice ? toHex(gasPrice) : '0x',
    gas ? toHex(gas) : '0x',
    to ?? '0x',
    value ? toHex(value) : '0x',
    seismicInput ?? '0x',
    ...toYParitySignatureArray(transaction, signature),
  ])
  const encodedTx = concatHex([
    toHex(74), // seismic tx type '0x4a'
    rlpEncoded,
  ])

  return encodedTx
}

export const seismicDevnet = /*#__PURE__*/ defineChain({
  // TODO
  id: 1337,
  name: 'Seismic',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
      webSocket: ['ws://127.0.0.1:8545'],
    },
  },
})
