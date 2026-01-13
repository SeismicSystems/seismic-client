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
  WriteContractReturnType,
} from 'viem'
import { getContract } from 'viem'
import { readContract, writeContract } from 'viem/actions'

import type { ShieldedWalletClient } from '@sviem/client.ts'
import {
  SignedReadContractParameters,
  signedReadContract,
} from '@sviem/contract/read.ts'
import {
  ShieldedWriteContractDebugResult,
  shieldedWriteContract,
  shieldedWriteContractDebug,
} from '@sviem/contract/write.ts'
import type { KeyedClient } from '@sviem/viem-internal/client.ts'
import type {
  GetReadFunction,
  GetWriteFunction,
} from '@sviem/viem-internal/function.ts'
import { getFunctionParameters } from '@sviem/viem-internal/function.ts'

type TransparentReadContractReturnType<
  TAbi extends Abi | readonly unknown[],
  TClient extends Client | KeyedClient = Client | KeyedClient,
  _readFunctionNames extends string = TAbi extends Abi
    ? Abi extends TAbi
      ? string
      : ExtractAbiFunctionNames<TAbi, 'pure' | 'view'>
    : string,
  _narrowable extends boolean = IsNarrowable<TAbi, Abi>,
  _publicClient extends Client | unknown = TClient extends {
    public: Client
  }
    ? TClient['public']
    : TClient,
> = _publicClient extends Client
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
        twrite: {
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
              : never,
            WriteContractReturnType
          >
        }
        dwrite: {
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
              : never,
            ShieldedWriteContractDebugResult<
              _walletClient['chain'],
              _walletClient['account']
            >
          >
        }
      }
  : unknown

/**
 * The same as viem's {@link https://viem.sh/docs/contract/getContract.html#with-wallet-client GetContractReturnType}, with a few differences:
 * - `read` and `write` use signed reads & seismic transactions
 * - `tread` and `twrite` behave like viem's standard read & write
 */
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
  TransparentWriteContractReturnType<TAbi, TClient>

/**
 * This function extends viem's base {@link https://viem.sh/docs/contract/getContract.html getContract} functionality by adding:
 * - `write`: write to a contract with encrypted calldata
 * - `read`: read from a contract using a signed read
 * - `tread`: transparently read from a contract using an unsigned read (from the zero address)
 * - `twrite`: transparently write to a contract using non-encrypted calldata
 * - `dwrite`: get plaintext and encrypted transaction without broadcasting
 *
 * @param {GetContractParameters} params - The configuration object.
 *   - `abi` ({@link Abi}) - The contract's ABI.
 *   - `address` ({@link Address}) - The contract's address.
 *   - `client` ({@link ShieldedWalletClient}) - The client instance to use for interacting with the contract.
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
 * const value = await contract.read.getValue();
 * console.log('Value:', value);
 * ```
 *
 * @remarks
 * - The `read` property will always call a signed read
 * - The `tread` property will toggle between public reads and signed reads, depending on whether an `account` is provided
 * - The `write` property will encrypt calldata of the transaction
 * - The `twrite` property will make a normal write, e.g. with transparent calldata
 * - The `dwrite` property will make the encrypted tx without writing
 * - The client must be a {@link ShieldedWalletClient}
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

  const transparentWriteAction = new Proxy(
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
          if (walletClient === undefined) {
            throw new Error('Must provide wallet client to call Contract.write')
          }
          const { args, options } = getFunctionParameters(parameters)
          return writeContract(walletClient, {
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
      throw new Error('Must provide wallet client to call Contract.write')
    }

    return shieldedWriteContract(walletClient, {
      abi,
      address,
      functionName,
      args,
      ...(options as any),
    })
  }

  function shieldedWriteDebug<
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
      throw new Error('Must provide wallet client to call Contract.dwrite')
    }

    return shieldedWriteContractDebug(walletClient, {
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

  const shieldedWriteDebugAction = new Proxy(
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
          return shieldedWriteDebug({
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
    TFunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
    TArgs extends ContractFunctionArgs<
      TAbi,
      'pure' | 'view',
      TFunctionName
    > = ContractFunctionArgs<TAbi, 'pure' | 'view', TFunctionName>,
  >(params: SignedReadContractParameters<TAbi, TFunctionName, TArgs>) {
    if (walletClient === undefined) {
      throw new Error('Must provide wallet client to call signed read')
    }
    return signedReadContract(walletClient, params)
  }

  const readAction = new Proxy(
    {},
    {
      get(_, functionName: string) {
        return (
          ...parameters: [
            args?: readonly unknown[] | undefined,
            options?: UnionOmit<
              ReadContractParameters,
              'abi' | 'address' | 'functionName' | 'args'
            >,
          ]
        ) => {
          const { args, options } = getFunctionParameters(parameters)
          // @ts-expect-error: account might be here
          if (!options?.account) {
            // @ts-expect-error: this is valid
            return readContract(walletClient, {
              abi,
              address,
              functionName,
              args,
              ...(options as any),
            })
          }
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
            args?: readonly unknown[] | undefined,
            options?: UnionOmit<
              ReadContractParameters,
              'abi' | 'address' | 'functionName' | 'args'
            >,
          ]
        ) => {
          if (!walletClient?.account) {
            console.error(JSON.stringify(walletClient, null, 2))
            throw new Error(
              'Wallet must have an account to perform signed reads'
            )
          }
          const params = getFunctionParameters(parameters)
          const { args } = params
          const {
            options: { account, ...options },
          } = params as { options: { account: any } & any }
          return signedRead({
            abi,
            address,
            functionName,
            args,
            // Force account to be their account
            // Node will reject it if they stick in a different account here,
            // because of the AEAD in encryption
            account: walletClient.account,
            ...options,
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
      | 'twrite'
      | 'dwrite']?: unknown
  } = viemContract
  // Transparent writes use the standard writeContract
  contract.twrite = transparentWriteAction
  // Transparent reads use signed reads,
  // but signing is only activated if they supply an account parameter
  contract.tread = readAction
  // Shielded writes use seismic transactions
  contract.write = shieldedWriteAction
  // Debug writes use seismic debug transactions
  contract.dwrite = shieldedWriteDebugAction
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
