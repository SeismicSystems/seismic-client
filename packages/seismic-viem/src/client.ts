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
 * Parameters required to create a public client.
 *
 * @property chain - The blockchain chain configuration.
 * @property transport - The transport mechanism for communication with the blockchain.
 */
export type GetPublicClientParameters<
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = undefined,
> = PublicClientConfig<TTransport, TChain> & { encryptionSk?: Hex | undefined }

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
> = GetPublicClientParameters<TTransport, TChain> & {
  account: TAccount
  publicClient?: ShieldedPublicClient<TTransport, TChain, undefined>
}

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
 * Creates a shielded public client with extended functionality for interacting
 * with shielded blockchain features.
 *
 * This function builds upon the base public client and extends it with shielded-specific actions,
 * such as retrieving the Trusted Execution Environment (TEE) public key and interacting with
 * shielded features.
 *
 * @example
 * ```typescript
 * const client = await createShieldedPublicClient({
 *   transport: httpTransport,
 *   chain: seismicChain,
 *   rpcSchema: customRpcSchema,
 * });
 *
 * // Use shielded public actions
 * const teePublicKey = await client.getTeePublicKey();
 * console.log('TEE Public Key:', teePublicKey);
 * ```
 *
 * @template transport - The type of the transport mechanism used for communication (extends `Transport`).
 * @template chain - The type of the blockchain chain (extends `Chain` or `undefined`).
 * @template rpcSchema - The type of the RPC schema (extends `RpcSchema` or `undefined`).
 *
 * @param parameters - The configuration parameters for creating the public client. Includes transport,
 * chain, and optional RPC schema definitions.
 *
 * @returns {ShieldedPublicClient<transport, chain, undefined, rpcSchema>} A shielded public client
 * instance with extended shielded actions.
 *
 * @remarks
 * The returned client includes all standard public client actions and additional
 * shielded-specific actions. It is suitable for applications requiring secure and
 * shielded interactions with blockchain networks.
 */
export const createShieldedPublicClient = <
  transport extends Transport,
  chain extends Chain | undefined = undefined,
  rpcSchema extends RpcSchema | undefined = undefined,
>(
  parameters: GetPublicClientParameters<transport, chain>
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
      encryptionSk,
    }))

  const networkPublicKey = await pubClient.getTeePublicKey()
  const { aesKey, encryptionPublicKey } = getEncryption(
    networkPublicKey,
    encryptionSk
  )

  const wallet = createClient({ account, chain, transport })
    .extend(walletActions)
    // @ts-ignore
    .extend(() => publicActions(pubClient))
    // @ts-ignore
    .extend(() => encryptionActions(aesKey, encryptionPublicKey))
    // @ts-ignore
    .extend(shieldedPublicActions)
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
