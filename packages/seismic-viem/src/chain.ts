import {
  concatHex,
  defineChain,
  formatTransactionRequest,
  hexToBigInt,
  toHex,
  toRlp,
} from 'viem'
import type {
  Address,
  BlockIdentifier,
  BlockNumber,
  BlockTag,
  Chain,
  ChainFormatters,
  ExactPartial,
  Hex,
  OneOf,
  RpcSchema,
  RpcStateOverride,
  SerializeTransactionFn,
  Signature,
  TransactionRequest,
  TransactionRequestLegacy,
  TransactionSerializable,
  TransactionSerializableLegacy,
  UnionOmit,
} from 'viem'

import { toYParitySignatureArray } from '@sviem/viem-internal/signature.ts'

export const SEISMIC_TX_TYPE = 74 // '0x4a'

/**
 * The additional fields added to a Seismic transaction
 * @interface SeismicTxExtras
 * @property {Hex} [encryptionPubkey] - The public key used to encrypt the calldata. This uses AES encryption, where the user's keypair is combined with the network's keypair
 * @property {number} [messageVersion] - The version of the message being sent. Used for signing transactions via messages. Normal transactions use messageVersion = 0. Txs signed with EIP-712 use messageVersion = 2
 */

type SeismicTxExtrasBlank = {
  encryptionPubkey?: undefined
  encryptionNonce?: undefined
  messageVersion?: undefined
  recentBlockHash?: undefined
  expiresAtBlock?: undefined
  signedRead?: undefined
}

export type SeismicTxExtras = {
  encryptionPubkey?: Hex | undefined
  encryptionNonce?: Hex | undefined
  messageVersion?: number | undefined
  recentBlockHash?: Hex | undefined
  expiresAtBlock?: bigint | undefined
  signedRead?: boolean | undefined
}

export type SeismicBlockParams = {
  recentBlockHash: Hex
  expiresAtBlock: bigint
}

export type SeismicElements = {
  encryptionPubkey: Hex
  encryptionNonce: Hex
  messageVersion: number
  signedRead: boolean
} & SeismicBlockParams

export type SeismicSecurityParams = {
  blocksWindow?: bigint
  encryptionNonce?: Hex
  recentBlockHash?: Hex
  expiresAtBlock?: bigint
}

/**
 * Represents a Seismic transaction request, extending viem's base {@link https://viem.sh/docs/glossary/types#transactionrequest TransactionRequest} with {@link SeismicTxExtras}
 *
 * @interface SeismicTransactionRequest
 * @extends {TransactionRequest}
 * @extends {SeismicTxExtras}
 */
export type SeismicTransactionRequest =
  | (TransactionRequest & SeismicTxExtrasBlank)
  | (UnionOmit<TransactionRequestLegacy, 'type'> &
      SeismicTxExtras & { type: 'seismic' })

/**
 * Represents a serializable Seismic transaction, extending viem's base {@link https://viem.sh/docs/utilities/parseTransaction#returns TransactionSerializable} with {@link SeismicTxExtras}
 *
 * @interface TransactionSerializableSeismic
 * @extends {TransactionSerializable}
 * @extends {SeismicTxExtras}
 */
export type TransactionSerializableSeismic =
  | (TransactionSerializable & SeismicTxExtrasBlank)
  | (UnionOmit<TransactionSerializable, 'type'> &
      SeismicTxExtras & { type: 'seismic' })

export type TxSeismic = {
  chainId?: number
  nonce?: bigint
  gasPrice?: bigint
  gasLimit?: bigint
  to?: Address | null
  value?: bigint
  input?: Hex
  encryptionPubkey: Hex
  encryptionNonce: Hex
  messageVersion: number
  recentBlockHash: Hex
  expiresAtBlock: bigint
  signedRead: boolean
}

export type SeismicTxSerializer = SerializeTransactionFn<
  TransactionSerializableSeismic,
  'seismic'
>

export const serializeSeismicTransaction: SeismicTxSerializer = (
  tx: OneOf<TransactionSerializable | TransactionSerializableSeismic>,
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
    encryptionNonce,
    messageVersion = 0,
    recentBlockHash,
    expiresAtBlock,
    signedRead = false,
  } = tx

  if (chainId === undefined) {
    throw new Error('Seismic transactions require chainId')
  }
  if (nonce === undefined) {
    throw new Error('Seismic transactions require nonce')
  }
  if (gasPrice === undefined) {
    throw new Error('Seismic transactions require gasPrice')
  }
  if (gas === undefined) {
    throw new Error('Seismic transactions require gas')
  }
  if (to === undefined) {
    throw new Error('Seismic transactions require to')
  }
  // value, input can be undefined
  if (encryptionPubkey === undefined) {
    throw new Error('Seismic transactions require encryptionPubkey')
  }
  if (encryptionNonce === undefined) {
    throw new Error('Seismic transactions require encryptionNonce')
  }
  if (recentBlockHash === undefined) {
    throw new Error('Seismic transactions require recentBlockHash')
  }
  if (expiresAtBlock === undefined) {
    throw new Error('Seismic transactions require expiresAtBlock')
  }
  if (data === undefined) {
    throw new Error('Seismic transactions require input')
  }

  // Seismic elements are encoded FLAT (not nested) - each field is a separate RLP item
  // Note: Zero values are encoded as empty bytes (0x) to match Rust's alloy-rlp encoding
  const rlpArray: Hex[] = [
    toHex(chainId),
    nonce ? toHex(nonce) : '0x',
    gasPrice ? toHex(gasPrice) : '0x',
    gas ? toHex(gas) : '0x',
    to ?? '0x',
    value ? toHex(value) : '0x',
    // Seismic elements fields (encoded flat, not as a nested list)
    encryptionPubkey ?? '0x',
    hexToBigInt(encryptionNonce) === 0n ? '0x' : encryptionNonce,
    messageVersion === 0 ? '0x' : toHex(messageVersion),
    recentBlockHash,
    toHex(expiresAtBlock),
    signedRead ? '0x01' : '0x',
    // Input field comes after seismic elements
    data ?? '0x',
    ...toYParitySignatureArray(tx as TransactionSerializableLegacy, signature),
  ]

  const rlpEncoded = toRlp(rlpArray)
  return concatHex([toHex(SEISMIC_TX_TYPE), rlpEncoded])
}

export const estimateGasRpcSchema = {
  Method: 'eth_estimateGas',
  Parameters: ['SeismicTransactionRequest'] as
    | [SeismicTransactionRequest]
    | [SeismicTransactionRequest, BlockNumber]
    | [SeismicTransactionRequest, BlockNumber, RpcStateOverride],
  ReturnType: 'Quantity',
}

export const callRpcSchema = {
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
}

export const seismicRpcSchema: RpcSchema = [estimateGasRpcSchema, callRpcSchema]

const hasSeismicFields = (request: SeismicTransactionRequest) => {
  return (
    request.encryptionPubkey !== undefined &&
    request.encryptionNonce !== undefined &&
    request.messageVersion !== undefined &&
    request.recentBlockHash !== undefined &&
    request.expiresAtBlock !== undefined &&
    request.signedRead !== undefined
  )
}

const fmtRpcRequest = (request: SeismicTransactionRequest) => {
  if (request.type === 'seismic') {
    const seismicFmt = formatTransactionRequest({
      ...request,
      type: 'legacy',
    })
    return { ...seismicFmt, type: SEISMIC_TX_TYPE }
  }

  const { type, ...fmt } = formatTransactionRequest(request)
  if (hasSeismicFields(request)) {
    return { ...fmt, type: SEISMIC_TX_TYPE }
  }
  return { ...fmt, type }
}

/**
 * Chain formatters for Seismic transactions, providing formatting utilities for transaction requests.
 * @property {SeismicTransactionRequest} transactionRequest - Formatter configuration for transaction requests
 * @property {Function} transactionRequest.format - Formats a Seismic transaction request into the required RPC format
 * @param {SeismicTransactionRequest} request - The transaction request to be formatted
 * @returns {Object} A formatted transaction request object containing:
 *   - All properties from the formatted RPC request
 *   - `type` (optional) - Set to '0x4a' if encryption public key is present
 *   - `data` (optional) - Transaction data if present
 *   - `encryptionPubkey` (optional) - Public key for transaction encryption
 *   - `chainId` (optional) - Chain ID for the transaction
 * @remarks
 * This function is called by viem's call, estimateGas, and sendTransaction.
 * We can use this to parse transaction request before sending it to the node
 */
export const seismicChainFormatters: ChainFormatters = {
  transactionRequest: {
    format: (request: SeismicTransactionRequest) => {
      // @ts-expect-error: anvil requires chainId to be set but estimateGas doesn't set it
      let chainId = request.chainId
      const formattedRpcRequest = fmtRpcRequest(request)

      if (request.type === 'seismic') {
        if (!request.encryptionNonce) {
          throw new Error(
            'Encryption nonce is required for seismic transactions'
          )
        }
        if (!request.encryptionPubkey) {
          throw new Error(
            'Encryption public key is required for seismic transactions'
          )
        }
        if (request.messageVersion !== 0 && request.messageVersion !== 2) {
          throw new Error(
            'Message version must be set to 0 or 2 for seismic transactions'
          )
        }
        if (!request.recentBlockHash) {
          throw new Error(
            'recentBlockHash is required for seismic transaction requests'
          )
        }
        if (!request.expiresAtBlock) {
          throw new Error(
            'expiresAtBlock is required for seismic transaction requests'
          )
        }
        if (request.signedRead === undefined) {
          throw new Error(
            'signedRead is required for seismic transaction requests'
          )
        }
      }

      const fmtSeismicReq = {
        ...formattedRpcRequest,
        chainId,
        encryptionPubkey: request.encryptionPubkey,
        encryptionNonce: request.encryptionNonce,
        messageVersion: request.messageVersion,
        recentBlockHash: request.recentBlockHash,
        expiresAtBlock: request.expiresAtBlock,
        signedRead: request.signedRead,
      }
      return fmtSeismicReq
    },
    type: 'transactionRequest',
  },
}

export type CreateSeismicDevnetParams = {
  nodeHost: string
  explorerUrl?: string
}

export type CreateSeismicTestnetParams = {
  nodeHost: string
  explorerUrl?: string
}

/**
 * Creates a Seismic chain configuration.
 *
 * @param {CreateSeismicDevnetParams} params - The parameters for creating a Seismic chain.
 *   - `nodeHost` (string) - The hostname for the node (e.g. `gcp-1.seismictest.net`).
 *   - `explorerUrl` (string, optional) - Block explorer URL.
 *
 * @throws {Error} Throws if `nodeHost` is not provided.
 *
 * @returns {Chain} A chain configuration object containing:
 *   - Chain ID: 5124.
 *   - Network name: 'Seismic'.
 *   - Native ETH currency configuration.
 *   - RPC URLs (HTTP and WebSocket endpoints).
 *   - Block explorer configuration (if applicable).
 *   - Seismic-specific transaction formatters.
 *
 * @example
 * ```typescript
 * const chain = createSeismicDevnet({ nodeHost: 'gcp-1.seismictest.net' });
 * ```
 */
export const createSeismicDevnet = /*#__PURE__*/ ({
  nodeHost,
  explorerUrl,
}: CreateSeismicDevnetParams): Chain => {
  if (!nodeHost) {
    throw new Error('Must set `nodeHost` argument, e.g. gcp-1.seismictest.net')
  }

  return defineChain({
    id: 5124,
    name: 'Seismic',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: {
      default: {
        http: [`https://${nodeHost}/rpc`],
        webSocket: [`wss://${nodeHost}/ws`],
      },
    },
    blockExplorers: explorerUrl
      ? {
          default: {
            name: 'SeismicScan',
            url: explorerUrl,
          },
        }
      : undefined,
    formatters: seismicChainFormatters,
  })
}

export const createSeismicAzTestnet = (n: number) =>
  createSeismicDevnet({
    nodeHost: `az-${n}.seismictest.net`,
    explorerUrl: 'https://seismic-testnet.socialscan.io',
  })

export const createSeismicGcpTestnet = (n: number) =>
  createSeismicDevnet({
    nodeHost: `gcp-${n}.seismictest.net`,
    explorerUrl: 'https://seismic-testnet.socialscan.io',
  })

/**
 * The first seismic testnet
 *
 * Nodes coordinate using summit, Seismic's consensus client
 */

export const seismicTestnet1 = createSeismicAzTestnet(1)
export const seismicTestnet2 = createSeismicAzTestnet(2)

export const seismicTestnetGcp1 = createSeismicGcpTestnet(1)
export const seismicTestnetGcp2 = createSeismicGcpTestnet(2)

export const seismicTestnet = seismicTestnet1

/**
 * For connecting to a locally-running seismic-reth instance on --dev mode
 */
export const localSeismicDevnet = /*#__PURE__*/ defineChain({
  id: 5124,
  name: 'Seismic',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
      ws: ['ws://127.0.0.1:8546'],
    },
  },
  formatters: seismicChainFormatters,
})

/**
 * For connecting to a locally-running seismic anvil instance.
 * Use {@link https://seismic-2.gitbook.io/seismic-book/getting-started/publish-your-docs#sforge-sanvil-and-ssolc sfoundryup}  to install this
 */
export const sanvil = /*#__PURE__*/ defineChain({
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
