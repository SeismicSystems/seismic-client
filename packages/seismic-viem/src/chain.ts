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
  Chain,
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

/**
 * The additional fields added to a Seismic transaction
 * @interface SeismicTxExtras
 * @property {Hex} [encryptionPubkey] - The public key used to encrypt the calldata. This uses AES encryption, where the user's keypair is combined with the network's keypair
 * @property {number} [messageVersion] - The version of the message being sent. Used for signing transactions via messages. Normal transactions use messageVersion = 0. Txs signed with EIP-712 use messageVersion = 2
 */
export type SeismicTxExtras = {
  encryptionPubkey?: Hex | undefined
  messageVersion?: number | undefined
}

/**
 * Represents a Seismic transaction request, extending viem's base {@link https://viem.sh/docs/glossary/types#transactionrequest TransactionRequest} with {@link SeismicTxExtras}
 *
 * @interface SeismicTransactionRequest
 * @extends {TransactionRequest}
 * @extends {SeismicTxExtras}
 */
export type SeismicTransactionRequest = TransactionRequest & SeismicTxExtras

/**
 * Represents a serializable Seismic transaction, extending viem's base {@link https://viem.sh/docs/utilities/parseTransaction#returns TransactionSerializable} with {@link SeismicTxExtras}
 *
 * @interface TransactionSerializableSeismic
 * @extends {TransactionSerializable}
 * @extends {SeismicTxExtras}
 */
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

export type CreateSeismicDevnetParams = { explorerUrl?: string } & (
  | { node?: number; nodeHost: string }
  | { node: number; nodeHost?: string }
)

/**
 * Creates a Seismic development network chain configuration.
 *
 * @param {CreateSeismicDevnetParams} params - The parameters for creating a Seismic devnet.
 *   - `node` (number, optional) - The node number for the devnet. If provided without `nodeHost`,
 *     the hostname will be generated as `node-{node}.seismicdev.net`.
 *   - `nodeHost` (string, optional) - The direct hostname for the node. Required if `node` is not provided.
 *   - `explorerUrl` (string, optional) - Custom block explorer URL. If not provided and `node` exists,
 *     defaults to `https://explorer-{node}.seismicdev.net`.
 *
 * @throws {Error} Throws if neither node number nor nodeHost is provided.
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
 * // Create using node number
 * const devnet1 = createSeismicDevnet({ node: 1 });
 *
 * // Create using custom host
 * const devnet2 = createSeismicDevnet({ nodeHost: 'custom.node.example.com' });
 * ```
 */
export const createSeismicDevnet = /*#__PURE__*/ ({
  node,
  nodeHost,
  explorerUrl,
}: CreateSeismicDevnetParams): Chain => {
  if (!node && !nodeHost) {
    throw new Error('Must set `nodeHost` argument, e.g. node-1.seismicdev.net')
  } else if (!nodeHost) {
    nodeHost = `node-${node}.seismicdev.net`
  }

  let blockExplorerUrl =
    explorerUrl ??
    (node ? `https://explorer-${node}.seismicdev.net` : undefined)

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
    blockExplorers: blockExplorerUrl
      ? {
          default: {
            name: 'SeismicScan',
            url: blockExplorerUrl,
          },
        }
      : undefined,
    formatters: seismicChainFormatters,
  })
}

/**
 * The seismic devnet running at node-1.seismicdev.net
 * Its associated explorer is at explorer-1.seismicdev.net
 *
 * This is a single-node network running seismic's fork of reth on --dev mode
 */
export const seismicDevnet1 = createSeismicDevnet({ node: 1 })
/**
 * The seismic devnet running at node-2.seismicdev.net
 * Its associated explorer is at explorer-2.seismicdev.net
 *
 * This is a single-node network running seismic's fork of reth on --dev mode
 */
export const seismicDevnet2 = createSeismicDevnet({ node: 1 })

/**
 * An alias for {@link seismicDevnet1}
 */
export const seismicDevnet = seismicDevnet1

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
      webSocket: ['ws://127.0.0.1:8546'],
    },
  },
  formatters: seismicChainFormatters,
})
