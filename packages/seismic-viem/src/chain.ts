import {
  concatHex,
  defineChain,
  formatTransactionRequest,
  serializeTransaction,
  toHex,
  toRlp,
} from 'viem'
import type {
  BlockIdentifier,
  BlockNumber,
  BlockTag,
  ChainFormatters,
  ExactPartial,
  Hex,
  RpcSchema,
  RpcStateOverride,
  RpcTransactionRequest,
  Signature,
  TransactionRequest,
  TransactionSerializable,
} from 'viem'

import { toYParitySignatureArray } from '@sviem/viem-internal/signature'

export type SeismicTransactionRequest = TransactionRequest & SeismicTxExtras

export type SeismicTxExtras = {
  seismicInput?: Hex | undefined
  encryptionPubkey?: Hex | undefined
}
export const stringifyBigInt = (_: any, v: any) =>
  typeof v === 'bigint' ? v.toString() : v

export const serializeSeismicTransaction = (
  transaction: TransactionSerializable & SeismicTxExtras,
  signature?: Signature
): Hex => {
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
    seismicInput ?? '0x',
    encryptionPubkey ?? '0x',
    ...toYParitySignatureArray(transaction, signature),
  ])
  const encodedTx = concatHex([
    toHex(74), // seismic tx type '0x4a'
    rlpEncoded,
  ])

  return encodedTx
}

export const seismicRpcSchema: RpcSchema = [
  {
    Method: 'eth_estimateGas',
    Parameters: ['SeismicTransactionRequest'] as
      | [SeismicTransactionRequest]
      | [SeismicTransactionRequest, BlockNumber]
      | [SeismicTransactionRequest, BlockNumber, RpcStateOverride],
    ReturnType: 'Quantity',
  },
  {
    Method: 'eth_call',
    Parameters: ['SeismicTransactionRequest'] as
      | [ExactPartial<SeismicTransactionRequest>]
      | [
          ExactPartial<SeismicTransactionRequest>,
          BlockNumber | BlockTag | BlockIdentifier,
        ]
      | [
          ExactPartial<SeismicTransactionRequest>,
          BlockNumber | BlockTag | BlockIdentifier,
          RpcStateOverride,
        ],
    ReturnType: 'Hex',
  },
]

// Define your formatter
const seismicChainFormatters: ChainFormatters = {
  transactionRequest: {
    format: (request: SeismicTransactionRequest) => {
      console.log('formatter input', request)

      const rpcRequest = formatTransactionRequest(request)

      let type = rpcRequest.type ?? '0x4a'
      let data = request.seismicInput ?? request.data
      let encryptionPubkey = request.encryptionPubkey

      let ret = {
        ...rpcRequest,
        ...(type !== undefined && { type }),
        ...(data !== undefined && { data }),
        ...(encryptionPubkey !== undefined && { encryptionPubkey }),
      }

      console.log('formatter output', ret)
      return ret
    },
    type: 'transactionRequest',
  },
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
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: {
      // TODO: publish real URLs
      // http: ['https://seismicdev.net/rpc'],
      // http: ['https://seismicdev.net/ws'],
      http: ['http://127.0.0.1:8545'],
      webSocket: ['ws://127.0.0.1:8545'],
    },
  },
  formatters: seismicChainFormatters,
})
