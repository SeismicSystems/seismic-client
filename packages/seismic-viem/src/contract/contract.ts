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
