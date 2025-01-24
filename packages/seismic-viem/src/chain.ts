import { concatHex, defineChain, toHex, toRlp } from 'viem'
import type {
  Address,
  Hex,
  Signature,
  TransactionSerializableLegacy,
} from 'viem'

import { toYParitySignatureArray } from '@sviem/viem-internal/signature'

export type SeismicTxExtras = { encryptionPubkey: Hex }
export type TransactionSerializableSeismic = TransactionSerializableLegacy &
  SeismicTxExtras & { from: Address }
export type TxSeismic = {
  type: number
  chainId?: number | undefined
  nonce?: bigint | undefined
  gasPrice?: bigint | undefined
  gasLimit?: bigint | undefined
  from?: Address
  to?: Address | null | undefined
  value?: bigint | undefined
  input?: Hex | undefined
  // TODO: serde alias in alloy
  encryptionPubkey: Hex
}

export const stringifyBigInt = (_: any, v: any) =>
  typeof v === 'bigint' ? v.toString() : v

export const serializeSeismicTransaction = (
  transaction: TransactionSerializableSeismic,
  signature?: Signature
): Hex => {
  const {
    chainId,
    nonce,
    gasPrice,
    gas,
    to,
    value = 0n,
    data,
    encryptionPubkey,
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
    data ?? '0x',
    encryptionPubkey ?? '0x',
    ...toYParitySignatureArray(transaction, signature),
  ])
  const encodedTx = concatHex([
    toHex(74), // seismic tx type '0x4a'
    rlpEncoded,
  ])

  return encodedTx
}

/**
 * Defines the Seismic development network configuration.
 *
 * This configuration includes the chain ID, name, native currency, and RPC URLs
 * for connecting to the Seismic development network. It can be used in applications
 * that interact with the blockchain using a defined chain.
 *
 * @type {Chain} - The configuration object for the Seismic devnet.
 * @property {number} id - The unique identifier (chain ID) of the Seismic devnet.
 * @property {string} name - The name of the Seismic network.
 * @property {Object} nativeCurrency - Details of the native currency used in the network.
 * @property {number} nativeCurrency.decimals - Decimal precision of the native currency.
 * @property {string} nativeCurrency.name - Name of the native currency.
 * @property {string} nativeCurrency.symbol - Symbol of the native currency.
 * @property {Object} rpcUrls - The RPC URLs for connecting to the network.
 * @property {Object} rpcUrls.default - Default RPC configuration.
 * @property {string[]} rpcUrls.default.http - HTTP URLs for RPC access.
 * @property {string[]} rpcUrls.default.webSocket - WebSocket URLs for RPC access.
 */
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
      // TODO: publish real URLs
      // http: ['https://seismicdev.net/rpc'],
      // http: ['https://seismicdev.net/ws'],
      http: ['http://127.0.0.1:8545'],
      webSocket: ['ws://127.0.0.1:8545'],
    },
  },
})
