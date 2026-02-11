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

import type {
  DepositContractPublicActions,
  DepositContractWalletActions,
} from '@sviem/actions/depositContract.ts'
import {
  depositContractPublicActions,
  depositContractWalletActions,
} from '@sviem/actions/depositContract.ts'
import {
  EncryptionActions,
  encryptionActions,
} from '@sviem/actions/encryption.ts'
import type { ShieldedPublicActions } from '@sviem/actions/public.ts'
import { shieldedPublicActions } from '@sviem/actions/public.ts'
import type {
  SRC20PublicActions,
  SRC20WalletActions,
} from '@sviem/actions/src20/src20Actions.ts'
import {
  src20PublicActions,
  src20WalletActions,
} from '@sviem/actions/src20/src20Actions.ts'
import type { ShieldedWalletActions } from '@sviem/actions/wallet.ts'
import { shieldedWalletActions } from '@sviem/actions/wallet.ts'
import { seismicRpcSchema } from '@sviem/chain.ts'
import { generateAesKey } from '@sviem/crypto/aes.ts'
import { compressPublicKey } from '@sviem/crypto/secp.ts'

/**
 * This is the same as viem's public client, with a few notable differences:
 * - `getTeePublicKey`: a new function specific to Seismic. It takes no parameters and returns a Promise that resolves to the network's public key
 * - `getStorageAt` and `getTransaction`: both of these will return an error since Seismic does not support these endpoints
 * - `deposit`: deposit into the deposit contract
 * - `getDepositRoot`: get the deposit root from the deposit contract
 * - `getDepositCount`: get the deposit count from the deposit contract
 * - `watchSRC20Events`: watch SRC20 events for the connected wallet
 * - `watchSRC20EventsWithKey`: watch SRC20 events with a viewing key
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
    PublicActions<transport, chain> &
      ShieldedPublicActions &
      DepositContractPublicActions &
      SRC20PublicActions
  >
>

/**
 * This has the same API as viem's wallet client, with a few notable differences:
 * - All public RPC requests are called through the provided public client
 * - This client will encrypt the calldata of Seismic transactions
 * - This exposes the following Seimsic-specific actions:
 *   - `getEncryption`: return an AES key and its generators
 *   - `getEncryptionPublicKey`: return only the user's encryption public key
 *   - `signedCall`: make an eth_call. The `data` parameter should already be encrypted
 *   - `sendShieldedTransaction`: send a Seismic transaction to the network. The `data` parameter should already be encrypted
 *   - `readContract`: call a contract function with a `signedRead`
 *   - `treadContract`: call a contract function with an unsigned read (from the zero address)
 *   - `writeContract`: execute a function on a contract via a Seismic transaction, encrypting the calldata
 *   - `twriteContract`: execute a function on a contract via a standard ethereum transaction
 *   - `deposit`: deposit into the deposit contract
 *   - `watchSRC20Events`: watch SRC20 events for the connected wallet
 */
export type ShieldedWalletClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account = Account,
  TRpcSchema extends RpcSchema | undefined = undefined,
> = Client<
  transport,
  chain,
  account,
  RpcSchema,
  PublicActions<transport, chain, account> &
    WalletActions<chain, account> &
    EncryptionActions &
    ShieldedPublicActions<TRpcSchema> &
    ShieldedWalletActions<chain, account> &
    DepositContractPublicActions &
    DepositContractWalletActions &
    SRC20WalletActions
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
 * @extends {PublicClientConfig<Transport, Chain>}
 * @property publicClient (optional) - The public client used to serve non-signing requests
 * @property privateKey (optional) - A secp256k1 private key, used to generate an AES key, which encrypts calldata. This is NOT the wallet's private key used to sign transactions.
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
 * @param parameters {@link https://viem.sh/docs/clients/public.html#parameters PublicClientConfig}: The same parameters passed into viem's {@link https://viem.sh/docs/clients/public.html | createPublicClient}. Two common args are:
 *   - `chain` ({@link Chain} | undefined) - The chain configuration to target (e.g., `seismicTestnet`).
 *   - `transport` ({@link Transport}) - The transport layer to use (e.g., an HTTP transport).
 *
 * @returns {ShieldedPublicClient<transport, chain, undefined, rpcSchema>}
 *
 * @example
 * ```typescript
 * import { http } from 'viem'
 * import { seismicTestnet, createShieldedPublicClient } from 'seismic-viem'
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
  return (
    viemPublicClient
      .extend(shieldedPublicActions as any)
      // @ts-ignore
      .extend(depositContractPublicActions as any)
      // @ts-ignore
      .extend(src20PublicActions as any)
  )
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
    (await createShieldedPublicClient<TTransport, TChain>({
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
    // @ts-ignore
    .extend(depositContractWalletActions as any)
    // @ts-ignore
    .extend(src20WalletActions as any)
  return {
    public: pubClient,
    wallet,
  }
}

/**
 * Creates a wallet client to perform reads & writes on the Seismic network
 *
 * @param {GetSeismicClientsParameters} parameters - The configuration object.
 *   - `chain` ({@link Chain} | undefined) - The chain configuration to target (e.g., `seismicTestnet`).
 *   - `transport` ({@link Transport}) - The transport layer to use (e.g., an HTTP transport).
 *   - `account` ({@link Account}) - The account to use for wallet operations.
 *   - `encryptionSk` (string) - The secret key used for shielded encryption.
 *   - `publicClient` (object, optional) - An optional public client instance for additional network interactions.
 *
 * @returns {Promise<ShieldedWalletClient>} A promise that resolves to a shielded wallet client instance.
 *
 * @example
 * ```typescript
 * import { http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { seismicTestnet, createShieldedWalletClient } from 'seismic-viem'
 *
 * const walletClient = await createShieldedWalletClient({
 *   chain: seismicTestnet,
 *   transport: http(),
 *   account: privateKeyToAccount('0x0123...')
 * });
 *
 * // Perform wallet operations
 * const result = await walletClient.writeContract({
 *   address: '0x1234...',
 *   data: '0xdeadbeef...',
 * });
 *
 * // Access shielded-specific actions
 * const { aesKey } = walletClient.getEncryption();
 * console.info('AES Key:', aesKey);
 * ```
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
