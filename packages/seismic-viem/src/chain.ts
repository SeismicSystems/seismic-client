import {
  concatHex,
  defineChain,
  formatTransactionRequest,
  toHex,
  toRlp,
} from 'viem'
import type {
  Address,
  BlockIdentifier,
  BlockNumber,
  BlockTag,
  ChainFormatters,
  ExactPartial,
  Hex,
  RpcSchema,
  RpcStateOverride,
  SerializeTransactionFn,
  Signature,
  TransactionRequest,
  TransactionSerializable,
  TransactionSerializableGeneric,
} from 'viem'

import { toYParitySignatureArray } from '@sviem/viem-internal/signature'

export type SeismicTxExtras = {
  encryptionPubkey?: Hex | undefined
  messageVersion?: number | undefined
}

export type SeismicTransactionRequest = TransactionRequest & SeismicTxExtras
export type TransactionSerializableSeismic = TransactionSerializable &
  SeismicTxExtras

export type TxSeismic = {
  chainId?: number | undefined
  nonce?: bigint | undefined
  gasPrice?: bigint | undefined
  gasLimit?: bigint | undefined
  to?: Address | null | undefined
  value?: bigint | undefined
  input?: Hex | undefined
  encryptionPubkey: Hex
  messageVersion: number | undefined
}

export const stringifyBigInt = (_: any, v: any) =>
  typeof v === 'bigint' ? v.toString() : v

export type SeismicTxSerializer =
  SerializeTransactionFn<TransactionSerializableSeismic>

export const serializeSeismicTransaction: SeismicTxSerializer = (
  transaction: TransactionSerializableSeismic,
  signature?: Signature
): Hex => {
  const {
    chainId,
    nonce,
    gasPrice,
    gas,
    to,
    data,
    value = 0n,
    encryptionPubkey,
    messageVersion = 0,
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
    encryptionPubkey ?? '0x',
    messageVersion ? toHex(messageVersion) : '0x',
    data ?? '0x',
    ...toYParitySignatureArray(
      transaction as TransactionSerializableGeneric,
      signature
    ),
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

export const allTransactionTypes = {
  seismic: '0x4a',
  legacy: '0x0',
  eip2930: '0x1',
  eip1559: '0x2',
  eip4844: '0x3',
  eip7702: '0x4',
} as const

// This function is called by viem's call, estimateGas, and sendTransaction, ...
// We can use this to parse transaction request before sending it to the node
export const seismicChainFormatters: ChainFormatters = {
  transactionRequest: {
    format: (request: SeismicTransactionRequest) => {
      const formattedRpcRequest = formatTransactionRequest(request)

      let data = formattedRpcRequest.data
      // @ts-ignore
      let chainId = request.chainId // anvil requires chainId to be set but estimateGas doesn't set it

      let encryptionPubkey
      let type
      if (request.encryptionPubkey) {
        encryptionPubkey = request.encryptionPubkey
        type = '0x4a'
      }

      let ret = {
        ...formattedRpcRequest,
        ...(type !== undefined && { type }),
        ...(data !== undefined && { data }),
        ...(encryptionPubkey !== undefined && { encryptionPubkey }),
        ...(chainId !== undefined && { chainId }),
      }

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
export const seismicDevnetChain = /*#__PURE__*/ defineChain({
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

export const anvilChain = /*#__PURE__*/ defineChain({
  id: 31_337,
  name: 'Anvil',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
      webSocket: ['ws://127.0.0.1:8545'],
    },
  },
  formatters: seismicChainFormatters,
})
