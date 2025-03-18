import type {
  Abi,
  AbiFunction,
  Account,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  Transport,
  WriteContractParameters,
  WriteContractReturnType,
} from 'viem'
import { encodeAbiParameters, getAbiItem, toFunctionSelector } from 'viem'
import { formatAbiItem } from 'viem/utils'

import type { ShieldedWalletClient } from '@sviem/client.ts'
import { remapSeismicAbiInputs } from '@sviem/contract/abi.ts'
import { AesGcmCrypto } from '@sviem/crypto/aes.ts'
import { randomEncryptionNonce } from '@sviem/crypto/nonce.ts'
import type { SendSeismicTransactionParameters } from '@sviem/sendTransaction.ts'
import { sendShieldedTransaction } from '@sviem/sendTransaction.ts'

/**
 * Executes a shielded write function on a contract, where the calldata is encrypted. The API for this is the same as viem's {@link https://viem.sh/docs/contract/writeContract writeContract}
 *
 *
 * @param {ShieldedWalletClient} client - The client to use.
 * @param {WriteContractParameters} parameters - The configuration object for the write operation.
 *   - `address` ({@link Hex}) - The address of the contract.
 *   - `abi` ({@link Abi}) - The contract's ABI.
 *   - `functionName` (string) - The name of the contract function to call.
 *   - `args` (array) - The arguments to pass to the contract function.
 *   - `gas` (bigint, optional) - Optional gas limit for the transaction.
 *   - `gasPrice` (bigint, optional) - Optional gas price for the transaction.
 *   - `value` (bigint, optional) - Optional value (native token amount) to send with the transaction.
 *
 * @returns {Promise<WriteContractReturnType>} A promise that resolves to a transaction hash.
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
    value,
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

  const encryptionNonce = randomEncryptionNonce()
  const data = await aesCipher.encrypt(plaintextCalldata, encryptionNonce)

  const request: SendSeismicTransactionParameters<TChain, TAccount> = {
    to: address,
    data,
    gas: gas!,
    gasPrice: gasPrice!,
    nonce: nonce!,
    value,
    encryptionPubkey: client.getEncryptionPublicKey(),
    encryptionNonce,
  }
  return sendShieldedTransaction(client, request)
}
