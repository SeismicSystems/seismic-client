import type {
  Abi,
  AbiFunction,
  Account,
  CallParameters,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  GetTransactionCountParameters,
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
import { formatAbiItem } from 'viem/utils'

import { ShieldedWalletClient } from '@sviem/client.ts'
import { remapSeismicAbiInputs } from '@sviem/contract/abi.ts'
import { AesGcmCrypto } from '@sviem/crypto/aes.ts'
import { randomEncryptionNonce } from '@sviem/crypto/nonce.ts'
import type { SignedCallParameters } from '@sviem/signedCall.ts'
import { signedCall } from '@sviem/signedCall.ts'

export type SignedReadContractParameters<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TArgs extends ContractFunctionArgs<TAbi, 'pure' | 'view', TFunctionName>,
> = ReadContractParameters<TAbi, TFunctionName, TArgs> & {
  nonce?: number
}

const fillNonce = async <
  TChain extends Chain | undefined,
  TAccount extends Account,
  const TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TArgs extends ContractFunctionArgs<TAbi, 'pure' | 'view', TFunctionName>,
>(
  client: ShieldedWalletClient<Transport, TChain, TAccount>,
  parameters: SignedReadContractParameters<TAbi, TFunctionName, TArgs>
) => {
  let account = parseAccount(parameters.account || client.account)
  const { nonce: nonce_ } = parameters
  if (nonce_) {
    return nonce_
  }

  const { blockNumber, blockTag = 'latest' } = parameters
  let args: GetTransactionCountParameters = {
    address: account.address,
    blockTag,
  }
  if (blockNumber) {
    args = { address: account.address, blockNumber }
  }
  return client.getTransactionCount(args)
}

/**
 * Executes a signed read operation on a smart contract.
 *
 * A signed read is an operation unique to Seismic's blockchain.
 * In Ethereum, users can make an eth_call and specify any `from` address.
 * However Seismic restricts this feature: any eth_call made to Seismic
 * will have the from address overridden to zero. We do this so contract
 * developers can check against `msg.sender` inside non-transactions knowing
 * that these calls will not be spoofed
 *
 * To make a read that specifies a from address on Seismic, use signed reads.
 * Essentially a signed read sends a signed, raw transaction to the eth_call endpoint.
 * The msg.sender for the call is set to the transaction's signer
 *
 * @param {ShieldedWalletClient} client - The client used to execute the signed read operation.
 *   Must be a {@link ShieldedPublicClient} or {@link ShieldedWalletClient}.
 * @param {SignedReadContractParameters} parameters - The parameters for the read operation, including:
 *   - `abi` ({@link Abi}) - The contract's ABI.
 *   - `functionName` (string) - The name of the function to call.
 *   - `args` (array) - The arguments for the function.
 *   - `address` ({@link Hex}) - The contract's address on the blockchain.
 *   - Additional options for customizing the call request.
 *
 * @returns {Promise<ReadContractReturnType>} A promise that resolves to the response from the contract.
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
  TFunctionName extends ContractFunctionName<TAbi, 'pure' | 'view'>,
  TArgs extends ContractFunctionArgs<TAbi, 'pure' | 'view', TFunctionName>,
>(
  client: ShieldedWalletClient<Transport, TChain, TAccount>,
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
  let account = rest.account
  if (!rest.account) {
    account = client.account
  }

  const nonce = await fillNonce(client, parameters)

  const seismicAbi = getAbiItem({ abi: abi, name: functionName }) as AbiFunction
  const selector = toFunctionSelector(formatAbiItem(seismicAbi))
  const ethAbi = remapSeismicAbiInputs(seismicAbi)
  const encodedParams = encodeAbiParameters(ethAbi.inputs, args).slice(2)
  const plaintextCalldata = `${selector}${encodedParams}` as `0x${string}`

  const aesKey = client.getEncryption()
  const aesCipher = new AesGcmCrypto(aesKey)

  const encryptionNonce = randomEncryptionNonce()
  const encryptedCalldata = await aesCipher.encrypt(
    plaintextCalldata,
    encryptionNonce
  )

  const request: SignedCallParameters<TChain> = {
    ...(rest as CallParameters),
    nonce,
    to: address!,
    data: encryptedCalldata,
    encryptionPubkey: client.getEncryptionPublicKey(),
    encryptionNonce,
  }
  const { data: encryptedData } = await signedCall(client, request)
  const data = await aesCipher.decrypt(encryptedData, encryptionNonce)
  return decodeFunctionResult({
    abi,
    args,
    functionName,
    data: data || '0x',
  }) as ReadContractReturnType<TAbi, TFunctionName>
}
