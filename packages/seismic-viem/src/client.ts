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
 * This is the same as viem's public client, with a few notable differences:
 * - `getTeePublicKey`: a new function specific to Seismic. It takes no parameters and returns a Promise that resolves to the network's public key
 * - `getStorageAt` and `getTransaction`: both of these will return an error since Seismic does not support these endpoints
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
    PublicActions<transport, chain> & ShieldedPublicActions
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
    ShieldedPublicActions &
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
 * @param parameters {@link https://viem.sh/docs/clients/public.html#parameters PublicClientConfig}: The same parameters passed into viem's {@link https://viem.sh/docs/clients/public.html | createPublicClient}
 *
 * @returns {ShieldedPublicClient<transport, chain, undefined, rpcSchema>}
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
 * Creates a wallet client to perform reads & writes on the Seismic network
 *
 * @param parameters {@link GetSeismicClientsParameters}
 * @returns {Promise<ShieldedWalletClient<Transport, Chain, Account>>}
 *
 * @example
 * ```typescript
 * import { http } from 'viem'
 * import { privateKeyToAccount } from 'viem/accounts'
 * import { seismicDevnet, createShieldedWalletClient } from 'seismic-viem'
 *
 * const walletClient = await createShieldedWalletClient({
 *   chain: seismicDevnet,
 *   transport: http(),
 *   account: privateKeyToAccount('0x0123...')
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
