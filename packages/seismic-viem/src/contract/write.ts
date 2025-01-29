import type {
  Abi,
  AbiFunction,
  AbiItemName,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  GetAbiItemParameters,
  Transport,
  WriteContractParameters,
  WriteContractReturnType,
} from 'viem'
import { encodeAbiParameters, getAbiItem, toFunctionSelector } from 'viem'
import { formatAbiItem } from 'viem/utils'

import type { ShieldedWalletClient } from '@sviem/client'
import { hasShieldedInputs, remapSeismicAbiInputs } from '@sviem/contract/abi'
import { AesGcmCrypto } from '@sviem/crypto/aes'
import type { SendSeismicTransactionParameters } from '@sviem/sendTransaction.js'
import { sendShieldedTransaction } from '@sviem/sendTransaction.js'

/**
  Determine whether the contract has shielded parameters.
  If so, we will encrypt the entire payload;
  If not, we will send a normal Ethereum transaction
  */
export function useSeismicWrite<
  const abi extends Abi | readonly unknown[],
  name extends AbiItemName<abi>,
>(parameters: GetAbiItemParameters<abi, name, undefined>): boolean {
  const { abi, name } = parameters as unknown as GetAbiItemParameters
  const abiItem = getAbiItem({ abi, name }) as AbiFunction
  return hasShieldedInputs(abiItem)
}

/**
 * Executes a shielded write function on a contract, where the calldata is encrypted. The API for this is the same as viem's {@link https://viem.sh/docs/contract/writeContract|writeContract}
 *
 * @param client - Client to use
 * @param parameters - {@link https://viem.sh/docs/contract/writeContract.html#parameters WriteContractParameters}
 * @returns A [Transaction Hash](https://viem.sh/docs/glossary/terms#hash). {@link https://viem.sh/docs/glossary/types#hash WriteContractReturnType}
 *
 * @example
 * import { custom, parseAbi } from 'viem'
 * import { createShieldedWalletContract, shieldedWriteContract, seismicDevnet } from 'seismic-viem'
 *
 * const client = createShieldedWalletClient({
 *   chain: seismicDevnet,
 *   transport: custom(window.ethereum),
 * })
 * const hash = await shieldedWriteContract(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
 *   functionName: 'mint',
 *   args: [69420],
 * })
 */
export async function shieldedWriteContract<
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
  const TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<
    TAbi,
    'nonpayable' | 'payable',
    TFunctionName
  >,
  chainOverride extends Chain | undefined = undefined,
>(
  client: ShieldedWalletClient<TTransport, TChain, TAccount>,
  parameters: WriteContractParameters<
    TAbi,
    TFunctionName,
    TArgs,
    TChain,
    TAccount,
    chainOverride
  >
): Promise<WriteContractReturnType> {
  const {
    abi,
    functionName,
    args = [],
    address,
    gas,
    gasPrice,
  } = parameters as WriteContractParameters
  let { nonce } = parameters as WriteContractParameters

  if (nonce === undefined) {
    nonce = await client.getTransactionCount({
      address: client.account?.address,
    })
  }

  const seismicAbi = getAbiItem({ abi, name: functionName }) as AbiFunction
  const selector = toFunctionSelector(formatAbiItem(seismicAbi))
  const ethAbi = remapSeismicAbiInputs(seismicAbi)
  const encodedParams = encodeAbiParameters(ethAbi.inputs, args).slice(2)
  const plaintextCalldata = `${selector}${encodedParams}` as `0x${string}`

  const aesKey = client.getEncryption()
  const aesCipher = new AesGcmCrypto(aesKey)
  const data = await aesCipher.encrypt(plaintextCalldata, nonce)

  const request: SendSeismicTransactionParameters<TChain, TAccount> = {
    to: address,
    data,
    gas: gas!,
    gasPrice: gasPrice!,
    nonce: nonce!,
    encryptionPubkey: client.getEncryptionPublicKey(),
  }
  return sendShieldedTransaction(client, request)
}
