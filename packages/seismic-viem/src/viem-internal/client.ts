import type { Account, Chain, Client, Transport } from 'viem'

/**
 * Represents a client configuration that includes either a public client, a wallet client, or both.
 *
 * This type allows flexibility in defining clients by enabling configurations where:
 * - Only the `public` client is provided.
 * - Only the `wallet` client is provided.
 * - Both `public` and `wallet` clients are provided.
 *
 * @template transport - The transport mechanism used for communication (extends `Transport`).
 * @template chain - The blockchain chain configuration (extends `Chain` or `undefined`).
 * @template account - The account type associated with the wallet client (extends `Account` or `undefined`).
 *
 * @type {KeyedClient} - A union of configurations:
 * - `{ public?: Client<transport, chain>; wallet: Client<transport, chain, account> }`: Includes a `wallet` client (mandatory) and an optional `public` client.
 * - `{ public: Client<transport, chain>; wallet?: Client<transport, chain, account> }`: Includes a `public` client (mandatory) and an optional `wallet` client.
 *
 * @remarks
 * - The `public` client is used for general-purpose, non-account-specific actions.
 * - The `wallet` client is used for account-specific operations such as transactions and contract interactions.
 *
 * @example
 * ```typescript
 * const keyedClient: KeyedClient<HttpTransport, SeismicChain, LocalAccount> = {
 *   public: createPublicClient({ transport: httpTransport, chain: seismicChain }),
 *   wallet: createWalletClient({ transport: httpTransport, chain: seismicChain, account: localAccount }),
 * };
 *
 * // Access the public client
 * const chainId = await keyedClient.public?.getChainId();
 *
 * // Access the wallet client
 * const txResult = await keyedClient.wallet?.sendTransaction({ to: '0x1234...', value: 1000n });
 * ```
 */
export type KeyedClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends Account | undefined = Account | undefined,
> =
  | {
      public?: Client<transport, chain> | undefined
      wallet: Client<transport, chain, account>
    }
  | {
      public: Client<transport, chain>
      wallet?: Client<transport, chain, account> | undefined
    }
