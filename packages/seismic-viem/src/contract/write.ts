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
 * Executes a write function on a contract.
 *
 * - Docs: https://viem.sh/docs/contract/writeContract
 * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/contracts/writing-to-contracts
 *
 * A "write" function on a Solidity contract modifies the state of the blockchain. These types of functions require gas to be executed, and hence a [Transaction](https://viem.sh/docs/glossary/terms) is needed to be broadcast in order to change the state.
 *
 * Internally, uses a [Wallet Client](https://viem.sh/docs/clients/wallet) to call the [`sendTransaction` action](https://viem.sh/docs/actions/wallet/sendTransaction) with [ABI-encoded `data`](https://viem.sh/docs/contract/encodeFunctionData).
 *
 * __Warning: The `write` internally sends a transaction – it does not validate if the contract write will succeed (the contract may throw an error). It is highly recommended to [simulate the contract write with `contract.simulate`](https://viem.sh/docs/contract/writeContract#usage) before you execute it.__
 *
 * @param client - Client to use
 * @param parameters - {@link https://viem.sh/docs/contract/writeContract.html#parameters WriteContractParameters}
 * @returns A [Transaction Hash](https://viem.sh/docs/glossary/terms#hash). {@link https://viem.sh/docs/glossary/types#hash WriteContractReturnType}
 *
 * @example
 * import { createWalletClient, custom, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { writeContract } from 'viem/contract'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: custom(window.ethereum),
 * })
 * const hash = await writeContract(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
 *   functionName: 'mint',
 *   args: [69420],
 * })
 *
 * @example
 * // With Validation
 * import { createWalletClient, http, parseAbi } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { simulateContract, writeContract } from 'viem/contract'
 *
 * const client = createWalletClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 * const { request } = await simulateContract(client, {
 *   address: '0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2',
 *   abi: parseAbi(['function mint(uint32 tokenId) nonpayable']),
 *   functionName: 'mint',
 *   args: [69420],
 * }
 * const hash = await writeContract(client, request)
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
