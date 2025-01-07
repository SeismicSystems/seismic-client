import type {
  Abi,
  AbiFunction,
  Account,
  CallParameters,
  Chain,
  Client,
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
import { readContract } from 'viem/actions'
import { formatAbiItem } from 'viem/utils'

import { remapSeismicAbiInputs } from '@sviem/contract/abi'
import type { SignedCallParameters } from '@sviem/signedCall'
import { signedCall } from '@sviem/signedCall'

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
  client: Client<Transport, TChain, TAccount>,
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
  // const data = await aesCipher.encrypt(encodedData, nonce).ciphertext
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
