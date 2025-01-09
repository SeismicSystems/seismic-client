import type { ExtractAbiFunctionNames } from 'abitype'
import type {
  Abi,
  Account,
  Address,
  Chain,
  Client,
  ContractFunctionArgs,
  ContractFunctionName,
  GetContractParameters,
  GetContractReturnType,
  Hex,
  IsNarrowable,
  IsNever,
  ReadContractParameters,
  Transport,
  UnionOmit,
  WalletClient,
  WriteContractParameters,
} from 'viem'
import { getContract } from 'viem'

import type { ShieldedWalletClient } from '@sviem/client'
import { signedReadContract } from '@sviem/contract/read'
import { shieldedWriteContract } from '@sviem/contract/write'
import type { KeyedClient } from '@sviem/viem-internal/client'
import type { GetReadFunction } from '@sviem/viem-internal/function'
import { getFunctionParameters } from '@sviem/viem-internal/function'

/**
 * Defines the return type for a signed read operation on a smart contract.
 *
 * This type determines the structure of the object returned when performing
 * signed read operations on a contract, based on the provided ABI, client, and
 * function names.
 *
 * @template TAbi - The ABI (Application Binary Interface) of the contract. This can be a strict `Abi` type
 * or an array of unknown items for less strict use cases.
 * @template TClient - The client type, either a standard `Client` or a `KeyedClient`.
 * @template _readFunctionNames - The names of the contract's `pure` or `view` functions, extracted from the ABI.
 * @template _narrowable - A boolean flag indicating whether the provided ABI is narrowable to a specific contract's ABI.
 * @template _walletClient - The client associated with the wallet, if applicable, otherwise defaults to the provided client.
 *
 * @type {SignedReadContractReturnType}
 *
 * @remarks
 * - If `_walletClient` is a valid client, the returned type includes a `sread` object.
 * - The `sread` object maps function names (`_readFunctionNames`) to callable read functions
 *   that match the contract's ABI for `pure` or `view` functions.
 * - If `_readFunctionNames` is `never`, the return type defaults to `unknown`.
 *
 * @example
 * ```typescript
 * type ReturnType = SignedReadContractReturnType<MyContractAbi, MyClient>;
 *
 * // Access the `sread` object with callable contract read functions
 * const value = await returnType.sread.getValue();
 * ```
 */
export type SignedReadContractReturnType<
  TAbi extends Abi | readonly unknown[],
  TClient extends Client | KeyedClient = Client | KeyedClient,
  _readFunctionNames extends string = TAbi extends Abi
    ? Abi extends TAbi
      ? string
      : ExtractAbiFunctionNames<TAbi, 'pure' | 'view'>
    : string,
  _narrowable extends boolean = IsNarrowable<TAbi, Abi>,
  _walletClient extends Client | unknown = TClient extends {
    wallet: Client
  }
    ? TClient['wallet']
    : TClient,
> = _walletClient extends Client
  ? IsNever<_readFunctionNames> extends true
    ? unknown
    : {
        sread: {
          [functionName in _readFunctionNames]: GetReadFunction<
            _narrowable,
            TAbi,
            functionName extends ContractFunctionName<TAbi, 'pure' | 'view'>
              ? functionName
              : never
          >
        }
      }
  : unknown

/**
 * Retrieves a shielded contract instance with extended functionality for performing
 * shielded write operations, signed reads, and contract interaction.
 *
 * This function extends the base `getContract` functionality by adding:
 * - Shielded write actions for `nonpayable` and `payable` functions.
 * - Signed read actions for `pure` and `view` functions.
 * - Proxy-based access to dynamically invoke contract methods.
 *
 * @template TTransport - The transport mechanism used for communication (extends `Transport`).
 * @template TAddress - The address type of the contract.
 * @template TAbi - The ABI (Application Binary Interface) of the contract, either strict `Abi` or unknown array.
 * @template TClient - The client type, supporting either a `ShieldedWalletClient` or `KeyedClient`.
 * @template TChain - The blockchain chain type (extends `Chain` or `undefined`).
 * @template TAccount - The account type associated with the wallet client (extends `Account` or `undefined`).
 *
 * @param abi - The ABI of the contract to interact with.
 * @param address - The address of the contract on the blockchain.
 * @param client - The client instance to use for interacting with the contract. Must be a shielded wallet client.
 *
 * @returns A contract instance with extended shielded write and signed read functionalities.
 * The returned object includes standard contract methods (`abi`, `address`, `createEventFilter`, etc.)
 * and shielded-specific methods (`write`, `read`, `sread`).
 *
 * @throws {Error} If the wallet client is not provided for shielded write or signed read operations.
 * @throws {Error} If the wallet client does not have an account configured for signed reads.
 *
 * @example
 * ```typescript
 * const contract = getShieldedContract({
 *   abi: myContractAbi,
 *   address: '0x1234...',
 *   client: shieldedWalletClient,
 * });
 *
 * // Perform a shielded write
 * await contract.write.myFunction([arg1, arg2], { gas: 50000n });
 *
 * // Perform a signed read
 * const value = await contract.sread.getValue();
 * console.log('Value:', value);
 * ```
 *
 * @remarks
 * - The `write` property allows dynamic invocation of `nonpayable` and `payable` functions.
 * - The `read` property will toggle between public reads and signed reads, depending on whether an `account` is provided
 * - The `sread` property does the same as `read`, except provides `account` as a parameter (so it always makes a signed read)
 * - The client must be a `ShieldedWalletClient` or provide a wallet client for shielded-specific operations.
 */
export function getShieldedContract<
  TTransport extends Transport,
  TAddress extends Address,
  const TAbi extends Abi | readonly unknown[],
  const TClient extends
    | ShieldedWalletClient<TTransport, TChain, TAccount>
    | KeyedClient<TTransport, TChain, TAccount>,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
>({
  abi,
  address,
  client,
}: GetContractParameters<
  TTransport,
  TChain,
  TAccount,
  TAbi,
  TClient,
  TAddress
>): GetContractReturnType<TAbi, TClient, TAddress> &
  SignedReadContractReturnType<TAbi, TClient> {
  const viemContract = getContract({ abi, address, client })

  const walletClient:
    | ShieldedWalletClient<TTransport, TChain, TAccount>
    | undefined = (() => {
    if (!client) return undefined
    if ('wallet' in client)
      return client.wallet as ShieldedWalletClient<TTransport, TChain, TAccount>
    return client as ShieldedWalletClient<TTransport, TChain, TAccount>
  })()

  function shieldedWrite<
    functionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
    args extends ContractFunctionArgs<
      TAbi,
      'payable' | 'nonpayable',
      functionName
    > = ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', functionName>,
  >({
    functionName,
    args,
    ...options
  }: WriteContractParameters<TAbi, functionName, args, TChain, TAccount>) {
    if (walletClient === undefined) {
      throw new Error('Must provide wallet client to write seismic contract')
    }

    return shieldedWriteContract(walletClient, {
      abi,
      address,
      functionName,
      args,
      ...(options as any),
    })
  }

  const shieldedWriteAction = new Proxy(
    {},
    {
      get(_, functionName: string) {
        return (
          ...parameters: [
            args?: readonly unknown[],
            options?: UnionOmit<
              WriteContractParameters,
              'abi' | 'address' | 'functionName' | 'args'
            >,
          ]
        ) => {
          const { args, options } = getFunctionParameters(parameters)
          return shieldedWrite({
            abi,
            address,
            functionName,
            args,
            ...(options as any),
          })
        }
      },
    }
  )

  function signedRead<
    functionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
    args extends ContractFunctionArgs<
      TAbi,
      'payable' | 'nonpayable',
      functionName
    > = ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', functionName>,
  >({
    functionName,
    args,
    ...options
  }: ReadContractParameters<TAbi, functionName, args>) {
    if (walletClient === undefined) {
      throw new Error('Must provide wallet client to write seismic contract')
    }

    return signedReadContract(walletClient, {
      abi,
      address,
      functionName,
      args,
      ...(options as any),
    })
  }

  const readAction = new Proxy(
    {},
    {
      get(_, functionName: string) {
        return (
          ...parameters: [
            args?: readonly unknown[],
            options?: UnionOmit<
              WriteContractParameters,
              'abi' | 'address' | 'functionName' | 'args'
            >,
          ]
        ) => {
          const { args, options } = getFunctionParameters(parameters)
          return signedRead({
            abi,
            address,
            functionName,
            args,
            ...(options as any),
          })
        }
      },
    }
  )

  const signedReadAction = new Proxy(
    {},
    {
      get(_, functionName: string) {
        return (
          ...parameters: [
            args?: readonly unknown[],
            options?: UnionOmit<
              WriteContractParameters,
              'abi' | 'address' | 'functionName' | 'args'
            >,
          ]
        ) => {
          if (!walletClient?.account) {
            console.error(JSON.stringify(walletClient, null, 2))
            throw new Error(
              'Wallet must have an account with address to perform signed reads'
            )
          }
          const params = getFunctionParameters(parameters)
          const { args } = params
          const {
            options: { account, ...options },
          } = params as { options: { account: any } }
          return signedRead({
            abi,
            address,
            functionName,
            args,
            // Force account to be their account
            account: walletClient.account.address,
            ...(options as any),
          })
        }
      },
    }
  )

  const contract: {
    [_ in
      | 'abi'
      | 'address'
      | 'createEventFilter'
      | 'estimateGas'
      | 'getEvents'
      | 'read'
      | 'simulate'
      | 'watchEvent'
      | 'write'
      | 'sread']?: unknown
  } = viemContract
  contract.write = shieldedWriteAction
  contract.read = readAction
  contract.sread = signedReadAction
  return contract as GetContractReturnType<TAbi, TClient, TAddress> &
    SignedReadContractReturnType<TAbi, TClient>
}
