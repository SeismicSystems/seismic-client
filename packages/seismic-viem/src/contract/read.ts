import type {
  Abi,
  AbiFunction,
  Account,
  CallParameters,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  Prettify,
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
import { readContract } from 'viem/actions'
import { formatAbiItem } from 'viem/utils'

import { ShieldedPublicClient, ShieldedWalletClient } from '@sviem/client'
import { remapSeismicAbiInputs } from '@sviem/contract/abi'
import type { SignedCallParameters } from '@sviem/signedCall'
import { signedCall } from '@sviem/signedCall'

type SignedReadClient<
  TChain extends Chain | undefined,
  TAccount extends Account | undefined,
> =
  | ShieldedPublicClient<Transport, TChain, TAccount>
  | ShieldedWalletClient<Transport, TChain, TAccount>

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
  TAccount extends Account | undefined,
  const TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  >,
>(
  client: SignedReadClient<TChain, TAccount>,
  parameters: ReadContractParameters<TAbi, TFunctionName, TArgs>
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
    return readContract(client, parameters)
  }

  const seismicAbi = getAbiItem({ abi: abi, name: functionName }) as AbiFunction
  const selector = toFunctionSelector(formatAbiItem(seismicAbi))
  const ethAbi = remapSeismicAbiInputs(seismicAbi)
  const encodedParams = encodeAbiParameters(ethAbi.inputs, args).slice(2)
  const encodedData = `${selector}${encodedParams}` as `0x${string}`

  // NOTE: can't encrypt calls because there's no nonce
  // const aesCipher = new AesGcmCrypto(aesKey)
  // const data = aesCipher.encrypt(encodedData, nonce).ciphertext
  const calldata = encodedData

  const request: SignedCallParameters<TChain> = {
    ...(rest as CallParameters),
    data: calldata,
    to: address!,
    seismicInput: undefined,
  }
  const { data } = await signedCall(client, request)
  return decodeFunctionResult({
    abi,
    args,
    functionName,
    data: data || '0x',
  }) as ReadContractReturnType<TAbi, TFunctionName>
}

/**
 * @ignore
 * Represents a signed read operation on a smart contract.
 *
 * This type defines the function signature for performing signed reads on a contract.
 * A signed read operation allows secure and authenticated interactions with contract functions
 * that are marked as `nonpayable` or `payable`.
 *
 * @template TAbi - The ABI (Application Binary Interface) of the contract. Defaults to `Abi | readonly unknown[]`.
 * @template TFunctionName - The name of the contract function being called. Must be a `nonpayable` or `payable` function.
 * @template TArgs - The arguments for the specified contract function, derived from the ABI and function name.
 *
 * @param args - The parameters for the signed read operation, including:
 * - `abi`: The contract's ABI.
 * - `functionName`: The name of the function being invoked.
 * - `args`: The arguments required for the function call.
 *
 * @returns {Promise<ReadContractReturnType>} A promise that resolves to the result of the signed read operation.
 *
 * @example
 * ```typescript
 * const signedRead: SignedReadContract<MyContractAbi> = async (args) => {
 *   const result = await signedReadContract({
 *     abi: myContractAbi,
 *     functionName: 'getBalance',
 *     args: ['0x1234...'],
 *   });
 *   return result;
 * };
 *
 * const result = await signedRead({
 *   abi: myContractAbi,
 *   functionName: 'getBalance',
 *   args: ['0x1234...'],
 * });
 * console.log('Balance:', result);
 * ```
 */
export type SignedReadContract<
  TAbi extends Abi | readonly unknown[] = Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<
    TAbi,
    'nonpayable' | 'payable'
  > = ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  > = ContractFunctionArgs<TAbi, 'payable' | 'nonpayable', TFunctionName>,
> = (
  args: ReadContractParameters<TAbi, TFunctionName, TArgs>
) => Promise<ReadContractReturnType>
