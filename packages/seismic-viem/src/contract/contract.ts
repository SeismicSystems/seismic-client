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
  IsNarrowable,
  IsNever,
  ReadContractParameters,
  Transport,
  UnionOmit,
  WriteContractParameters,
} from 'viem'
import { getContract } from 'viem'

import type { ShieldedWalletClient } from '@sviem/client'
import { signedReadContract } from '@sviem/contract/read'
import { shieldedWriteContract } from '@sviem/contract/write'
import type { KeyedClient } from '@sviem/viem-internal/client'
import type {
  GetReadFunction,
  GetWriteFunction,
} from '@sviem/viem-internal/function'
import { getFunctionParameters } from '@sviem/viem-internal/function'

type TransparentReadContractReturnType<
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
        tread: {
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

type TransparentWriteContractReturnType<
  TAbi extends Abi | readonly unknown[],
  TClient extends Client | KeyedClient = Client | KeyedClient,
  _writeFunctionNames extends string = TAbi extends Abi
    ? Abi extends TAbi
      ? string
      : ExtractAbiFunctionNames<TAbi, 'nonpayable' | 'payable'>
    : string,
  _narrowable extends boolean = IsNarrowable<TAbi, Abi>,
  _walletClient extends Client | unknown = TClient extends {
    wallet: Client
  }
    ? TClient['wallet']
    : TClient,
> = _walletClient extends Client
  ? IsNever<_writeFunctionNames> extends true
    ? unknown
    : {
        write: {
          [functionName in _writeFunctionNames]: GetWriteFunction<
            _narrowable,
            _walletClient['chain'],
            _walletClient['account'],
            TAbi,
            functionName extends ContractFunctionName<
              TAbi,
              'nonpayable' | 'payable'
            >
              ? functionName
              : never
          >
        }
      }
  : unknown

export type ShieldedContract<
  TTransport extends Transport = Transport,
  TAddress extends Address = Address,
  TAbi extends Abi | readonly unknown[] = Abi,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account = Account,
  TClient extends
    | ShieldedWalletClient<TTransport, TChain, TAccount>
    | KeyedClient<TTransport, TChain, TAccount> = ShieldedWalletClient<
    TTransport,
    TChain,
    TAccount
  >,
> = GetContractReturnType<TAbi, TClient, TAddress> &
  TransparentReadContractReturnType<TAbi, TClient> &
  TransparentWriteContractReturnType<TAbi, TClient, TAddress>

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
  TAccount extends Account = Account,
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
>): ShieldedContract<TTransport, TAddress, TAbi, TChain, TAccount, TClient> {
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
      throw new Error('Must provide wallet client to read seismic contract')
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
      | 'simulate'
      | 'watchEvent'
      | 'read'
      | 'tread'
      | 'write'
      | 'twrite']?: unknown
  } = viemContract
  // Transparent writes use the standard writeContract
  contract.twrite = contract.write
  // Transparent reads use signed reads,
  // but signing is only activated if they supply an account parameter
  contract.tread = readAction
  // Shielded writes use seismic transactions
  contract.write = shieldedWriteAction
  // The default read is signed read, where we sign the raw tx with user's account
  contract.read = signedReadAction
  return contract as ShieldedContract<
    TTransport,
    TAddress,
    TAbi,
    TChain,
    TAccount,
    TClient
  >
}
