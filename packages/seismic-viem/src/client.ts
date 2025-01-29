import type {
  Account,
  Chain,
  Client,
  Hex,
  Prettify,
  PublicActions,
  PublicClientConfig,
  PublicRpcSchema,
  RpcSchema,
  Transport,
  WalletActions,
} from 'viem'
import {
  createClient,
  createPublicClient,
  publicActions,
  walletActions,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { EncryptionActions, encryptionActions } from '@sviem/actions/encryption'
import type { ShieldedPublicActions } from '@sviem/actions/public'
import { shieldedPublicActions } from '@sviem/actions/public'
import type { ShieldedWalletActions } from '@sviem/actions/wallet'
import { shieldedWalletActions } from '@sviem/actions/wallet'
import { seismicRpcSchema } from '@sviem/chain'
import { generateAesKey } from '@sviem/crypto/aes'
import { compressPublicKey } from '@sviem/crypto/secp'

/**
 * Represents a shielded public client with extended functionality for interacting
 * with a blockchain network. This client type combines public RPC schema actions
 * with shielded-specific actions.
 *
 * @template transport - The type of the transport mechanism used for communication (extends `Transport`).
 * @template chain - The type of the blockchain chain (extends `Chain` or `undefined`).
 * @template accountOrAddress - The type of the account or address associated with the client (extends `Account` or `undefined`).
 * @template rpcSchema - The type of the RPC schema (extends `RpcSchema` or `undefined`).
 *
 * @type {Prettify<Client>} - A prettified version of the `Client` type with the following features:
 * - The transport mechanism (`transport`).
 * - The blockchain chain (`chain`).
 * - The associated account or address (`accountOrAddress`).
 * - The RPC schema, which extends the `PublicRpcSchema` with additional methods if provided.
 * - A combination of `PublicActions` and `ShieldedPublicActions`.
 *
 * @remarks
 * This client is designed to support both standard public actions and shielded-specific actions.
 * If an additional `rpcSchema` is provided, it is appended to the default `PublicRpcSchema`.
 *
 * @example
 * ```typescript
 * const client: ShieldedPublicClient<HttpTransport, SeismicChain, LocalAccount> = createShieldedClient({
 *   transport: httpTransport,
 *   chain: seismicChain,
 * });
 *
 * // Use the client for shielded actions
 * const result = await client.shieldedAction(...);
 * ```
 */
export type ShieldedPublicClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  accountOrAddress extends Account | undefined = undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
> = Prettify<
  Client<
    transport,
    chain,
    accountOrAddress,
    rpcSchema extends RpcSchema
      ? [...PublicRpcSchema, ...rpcSchema]
      : PublicRpcSchema,
    PublicActions<transport, chain> & ShieldedPublicActions<chain>
  >
>

/**
 * Represents a shielded wallet client with extended functionality for interacting
 * with shielded contracts, performing wallet operations, and executing public actions.
 *
 * @template transport - The transport mechanism used for communication (extends `Transport`).
 * @template chain - The blockchain chain configuration (extends `Chain` or `undefined`).
 * @template account - The account type associated with the wallet client (extends `Account` or `undefined`).
 *
 * @type {Client} - A specialized client type that includes:
 * - The transport mechanism (`transport`).
 * - The blockchain chain (`chain`).
 * - The associated account (`account`).
 * - The RPC schema (`RpcSchema`).
 * - A combination of actions:
 *   - `PublicActions`: Standard public client actions.
 *   - `WalletActions`: Actions for wallet-specific functionality.
 *   - `ShieldedWalletActions`: Enhanced actions for interacting with shielded features.
 *
 * @remarks
 * The `ShieldedWalletClient` extends the base `Client` type by combining public, wallet, and shielded-specific
 * actions into a single client. It is designed for secure and advanced blockchain interactions that require
 * encryption and shielded transaction capabilities.
 *
 * @example
 * ```typescript
 * const client: ShieldedWalletClient<HttpTransport, SeismicChain, LocalAccount> = createShieldedWalletClient({
 *   chain: seismicChain,
 *   transport: httpTransport,
 *   privateKey: '0xabcdef...',
 * });
 *
 * // Access wallet-specific and shielded actions
 * const writeResult = await client.writeContract({
 *   address: '0x1234...',
 *   data: '0xdeadbeef...',
 * });
 * const encryptionKey = client.getEncryption();
 * console.log('Encryption Key:', encryptionKey);
 * ```
 */
export type ShieldedWalletClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account = Account,
> = Client<
  transport,
  chain,
  account,
  RpcSchema,
  PublicActions<transport, chain, account> &
    WalletActions<chain, account> &
    EncryptionActions &
    ShieldedPublicActions<chain> &
    ShieldedWalletActions<chain, account>
>

type SeismicClients<
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
> = {
  public: ShieldedPublicClient<TTransport, TChain, undefined>
  wallet: ShieldedWalletClient<TTransport, TChain, TAccount>
}

/**
 * @ignore
 * Parameters required to create seismic clients, including a public client and a shielded wallet client.
 * @extends GetPublicClientParameters
 *
 * @property privateKey - The private key used to derive the wallet account and encryption key.
 */
export type GetSeismicClientsParameters<
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
> = PublicClientConfig<TTransport, TChain> & {
  account: TAccount
  publicClient?: ShieldedPublicClient<TTransport, TChain, undefined>
  encryptionSk?: Hex | undefined
}

/**
 * Returns an AES key and its input keys
 *
 * @param networkPk - The network's encryption public key (secp256k1)
 * @param clientSk - Optionally, the user's encryption private key. If not provided, this function will generate one
 * @returns {Object} An object with 3 fields:
 *   - `aesKey` (string) - The AES key used to encrypt calldata
 *   - `encryptionPrivateKey` (string) - Either `clientSk` if it was provided. Otherwise a newly generated secp256k1 private key
 *   - `encryptionPublicKey` (string) - The corresponding secp256k1 public key
 */
export const getEncryption = (
  networkPk: string,
  clientSk?: Hex | undefined
): { aesKey: Hex; encryptionPrivateKey: Hex; encryptionPublicKey: Hex } => {
  const encryptionPrivateKey = clientSk ?? generatePrivateKey()
  const aesKey = generateAesKey({
    privateKey: encryptionPrivateKey,
    networkPublicKey: networkPk,
  })
  const uncompressedPk = privateKeyToAccount(encryptionPrivateKey).publicKey
  const encryptionPublicKey = compressPublicKey(uncompressedPk)
  return { encryptionPrivateKey, encryptionPublicKey, aesKey }
}

/**
 * Creates a public client for the Seismic network.
 *
 * @template transport - The type of the transport mechanism used for communication (extends `Transport`).
 * @template chain - The type of the blockchain chain (extends `Chain` or `undefined`).
 * @template rpcSchema - The type of the RPC schema (extends `RpcSchema` or `undefined`).
 *
 * @param {PublicClientConfig} - The same parameters passed into viem's {@link https://viem.sh/docs/clients/public.html| createPublicClient}
 *
 * @returns {ShieldedPublicClient<transport, chain, undefined, rpcSchema>}
 *
 * @remarks
 * This has the same exact behaviour as viem's, with a few notable differences:
 * - `getTeePublicKey`: a new function specific to Seismic. It takes no parameters and returns a Promise containing the network's public key
 * - `getStorageAt` and `getTransaction`: both of these will return an error since Seismic does not support these endpoints
 *
 * @example
 * ```typescript
 * import { http } from 'viem'
 * import { seismicDevnet, createShieldedPublicClient } from 'seismic-viem'
 *
 * const client = await createShieldedPublicClient({
 *   transport: http(),
 *   chain: seismicChain,
 * });
 *
 * const teePublicKey = await client.getTeePublicKey();
 * ```
 */
export const createShieldedPublicClient = <
  transport extends Transport,
  chain extends Chain | undefined = undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
>(
  parameters: PublicClientConfig<transport, chain>
): ShieldedPublicClient<transport, chain, undefined, rpcSchema> => {
  const viemPublicClient = createPublicClient<
    transport,
    chain,
    undefined,
    rpcSchema
  >(parameters) as ShieldedPublicClient<transport, chain, undefined, rpcSchema>
  return viemPublicClient.extend(shieldedPublicActions as any)
}

export const getSeismicClients = async <
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
>({
  chain,
  transport,
  account,
  encryptionSk,
  publicClient,
}: GetSeismicClientsParameters<TTransport, TChain, TAccount>): Promise<
  SeismicClients<TTransport, TChain, TAccount>
> => {
  const pubClient: ShieldedPublicClient<TTransport, TChain, undefined> =
    publicClient ??
    (await createShieldedPublicClient<TTransport, TChain, undefined>({
      chain,
      transport,
    }))

  const networkPublicKey = await pubClient.getTeePublicKey()
  const { aesKey, encryptionPublicKey } = getEncryption(
    networkPublicKey,
    encryptionSk
  )

  const wallet = createClient({
    account,
    chain,
    transport,
    rpcSchema: seismicRpcSchema,
  })
    .extend(walletActions)
    // @ts-ignore
    .extend(() => publicActions(pubClient))
    // @ts-ignore
    .extend(() => encryptionActions(aesKey, encryptionPublicKey))
    // @ts-ignore
    .extend(() => shieldedPublicActions(pubClient))
    // @ts-ignore
    .extend(shieldedWalletActions)

  return {
    public: pubClient,
    wallet,
  }
}

/**
 * Creates a shielded wallet client with extended functionality for interacting
 * with shielded blockchain features, wallet operations, and encryption.
 *
 * This function builds upon the `getSeismicClients` helper to initialize and configure
 * a shielded wallet client using a provided private key. The client supports standard
 * wallet operations, public actions, and shielded-specific actions.
 *
 * @param chain - The blockchain chain configuration.
 * @param transport - The transport mechanism for communication with the blockchain.
 * @param privateKey - The private key used to derive the wallet account and encryption key.
 *
 * @returns {Promise<ShieldedWalletClient<Transport, Chain, Account>>} A promise that resolves
 * to a fully configured shielded wallet client.
 *
 * @example
 * ```typescript
 * const walletClient = await createShieldedWalletClient({
 *   chain: seismicChain,
 *   transport: httpTransport,
 *   privateKey: '0xabcdef...',
 * });
 *
 * // Perform wallet operations
 * const result = await walletClient.writeContract({
 *   address: '0x1234...',
 *   data: '0xdeadbeef...',
 * });
 *
 * // Access shielded-specific actions
 * const encryptionKey = walletClient.getEncryption();
 * console.log('Encryption Key:', encryptionKey);
 * ```
 *
 * @remarks
 * This function is a wrapper around `getSeismicClients`, extracting and returning the wallet
 * client from the generated clients. The shielded wallet client is equipped with:
 * - Public actions
 * - Wallet-specific actions
 * - Shielded-specific actions
 *
 * The encryption key is derived from the provided private key and the TEE public key of the network.
 */
export const createShieldedWalletClient = async <
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
>({
  chain,
  transport,
  account,
  encryptionSk,
  publicClient,
}: GetSeismicClientsParameters<TTransport, TChain, TAccount>): Promise<
  ShieldedWalletClient<TTransport, TChain, TAccount>
> => {
  const clients = await getSeismicClients({
    chain,
    transport,
    account,
    encryptionSk,
    publicClient,
  })
  return clients.wallet
}
