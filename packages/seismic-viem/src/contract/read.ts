import type {
  Abi,
  AbiFunction,
  Account,
  CallParameters,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  ReadContractParameters,
  ReadContractReturnType,
  Transport,
} from 'viem'
import {
  decodeFunctionResult,
  encodeAbiParameters,
  getAbiItem,
  toFunctionSelector,
} from 'viem'
import { parseAccount } from 'viem/accounts'
import { readContract } from 'viem/actions'
import { formatAbiItem } from 'viem/utils'

import { ShieldedPublicClient, ShieldedWalletClient } from '@sviem/client'
import { remapSeismicAbiInputs } from '@sviem/contract/abi'
import { AesGcmCrypto } from '@sviem/crypto/aes'
import type { SignedCallParameters } from '@sviem/signedCall'
import { signedCall } from '@sviem/signedCall'

type SignedReadClient<
  TChain extends Chain | undefined,
  TAccount extends Account,
> =
  | ShieldedPublicClient<Transport, TChain, TAccount>
  | ShieldedWalletClient<Transport, TChain, TAccount>

export type SignedReadContractParameters<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  >,
> = ReadContractParameters<TAbi, TFunctionName, TArgs> & {
  nonce?: number
}

/**
 * Executes a signed read operation on a smart contract.
 *
 * This function securely interacts with a contract's `nonpayable` or `payable` function by signing the request.
 * It supports advanced functionality such as parameter encoding and ABI remapping for shielded operations.
 *
 * @template TChain - The blockchain chain type (extends `Chain` or `undefined`).
 * @template TAccount - The account type used for signing the read operation (extends `Account` or `undefined`).
 * @template TAbi - The ABI (Application Binary Interface) of the contract, supporting `Abi` or unknown arrays.
 * @template TFunctionName - The name of the contract function to call (`nonpayable` or `payable`).
 * @template TArgs - The arguments for the function call, derived from the ABI and function name.
 *
 * @param client - The client used to execute the signed read operation. Must be a {@link ShieldedPublicClient} or {@link ShieldedWalletClient}.
 * @param parameters - The {@link https://viem.sh/docs/contract/readContract.html#parameters parameters} for the read operation, including:
 * - `abi`: The contract's ABI.
 * - `functionName`: The name of the function to call.
 * - `args`: The arguments for the function.
 * - `address`: The contract's address on the blockchain.
 * - Additional options for customizing the call request.
 *
 * @returns {Promise<ReadContractReturnType>} A promise that resolves to the response from the contract. Type is inferred from the ABI
 *
 * @throws {Error} If the account is not specified for the operation.
 *
 * @example
 * ```typescript
 * const result = await signedReadContract(client, {
 *   abi: myContractAbi,
 *   functionName: 'getBalance',
 *   args: ['0x1234...'],
 *   address: '0x5678...',
 * });
 * console.log('Balance:', result);
 * ```
 *
 * @remarks
 * - If no `account` is specified in the parameters, the function defaults to using a standard read operation (`readContract`).
 * - Encodes the ABI parameters and function selector for shielded calls.
 * - Uses `signedCall` to securely sign and send the request.
 * - The `data` returned by the contract call is decoded based on the provided ABI.
 */
export async function signedReadContract<
  TChain extends Chain | undefined,
  TAccount extends Account,
  const TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  >,
>(
  client: SignedReadClient<TChain, TAccount>,
  parameters: SignedReadContractParameters<TAbi, TFunctionName, TArgs>
  // aesKey: Hex,
): Promise<ReadContractReturnType> {
  const {
    abi,
    functionName,
    args = [],
    address,
    ...rest
  } = parameters as ReadContractParameters

  // If they specify no address, then use the standard read contract,
  // since it doesn't have to be signed
  if (!rest.account) {
    return readContract(client, parameters as ReadContractParameters)
  }

  const account = parseAccount(rest.account)

  const { nonce: nonce_ } = parameters
  const nonce =
    nonce_ ?? (await client.getTransactionCount({ address: account.address }))

  const seismicAbi = getAbiItem({ abi: abi, name: functionName }) as AbiFunction
  const selector = toFunctionSelector(formatAbiItem(seismicAbi))
  const ethAbi = remapSeismicAbiInputs(seismicAbi)
  const encodedParams = encodeAbiParameters(ethAbi.inputs, args).slice(2)
  const plaintextCalldata = `${selector}${encodedParams}` as `0x${string}`

  const aesKey = client.getEncryption()
  const aesCipher = new AesGcmCrypto(aesKey)
  const encryptedCalldata = await aesCipher.encrypt(plaintextCalldata, nonce)

  const request: SignedCallParameters<TChain> = {
    ...(rest as CallParameters),
    nonce,
    to: address!,
    seismicInput: encryptedCalldata,
  }
  const { data } = await signedCall(client, request)
  return decodeFunctionResult({
    abi,
    args,
    functionName,
    data: data || '0x',
  }) as ReadContractReturnType<TAbi, TFunctionName>
}
