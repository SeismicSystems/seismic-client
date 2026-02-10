import type {
  Abi,
  AbiFunction,
  Account,
  Address,
  Chain,
  ContractFunctionArgs,
  ContractFunctionName,
  Hash,
  Hex,
  Transport,
  WriteContractParameters,
  WriteContractReturnType,
} from 'viem'
import {
  encodeAbiParameters,
  getAbiItem,
  numberToHex,
  toFunctionSelector,
} from 'viem'
import { formatAbiItem } from 'viem/utils'

import { SEISMIC_TX_TYPE, SeismicSecurityParams } from '@sviem/chain.ts'
import type { ShieldedWalletClient } from '@sviem/client.ts'
import { remapSeismicAbiInputs } from '@sviem/contract/abi.ts'
import { randomEncryptionNonce } from '@sviem/crypto/nonce.ts'
import { buildTxSeismicMetadata } from '@sviem/metadata.ts'
import type { SendSeismicTransactionParameters } from '@sviem/sendTransaction.ts'
import { sendShieldedTransaction } from '@sviem/sendTransaction.ts'

export const getPlaintextCalldata = <
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
  parameters: WriteContractParameters<
    TAbi,
    TFunctionName,
    TArgs,
    TChain,
    TAccount,
    chainOverride
  >
): Hex => {
  const { abi, functionName, args = [] } = parameters as WriteContractParameters
  const seismicAbi = getAbiItem({ abi, name: functionName }) as AbiFunction
  const selector = toFunctionSelector(formatAbiItem(seismicAbi))
  const ethAbi = remapSeismicAbiInputs(seismicAbi)
  const encodedParams = encodeAbiParameters(ethAbi.inputs, args).slice(2)
  const plaintextCalldata = `${selector}${encodedParams}` as Hex
  return plaintextCalldata
}

async function getShieldedWriteContractRequest<
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
  TChainOverride extends Chain | undefined = undefined,
>(
  client: ShieldedWalletClient<TTransport, TChain, TAccount>,
  parameters: WriteContractParameters<
    TAbi,
    TFunctionName,
    TArgs,
    TChain,
    TAccount,
    TChainOverride
  >,
  plaintextCalldata: Hex
): Promise<SendSeismicTransactionParameters<TChain, TAccount>> {
  const { address, gas, gasPrice, value, nonce } = parameters
  return {
    account: client.account,
    chain: undefined,
    to: address,
    data: plaintextCalldata,
    nonce,
    value,
    gas,
    gasPrice,
  }
}

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
 * import { createShieldedWalletContract, shieldedWriteContract, seismicTestnet } from 'seismic-viem'
 *
 * const client = createShieldedWalletClient({
 *   chain: seismicTestnet,
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
  const plaintextCalldata = getPlaintextCalldata(parameters)
  const request = await getShieldedWriteContractRequest(
    client,
    parameters,
    plaintextCalldata
  )
  return sendShieldedTransaction(client, request)
}

type PlaintextTransactionParameters = {
  to: Address | null
  data: Hex
  nonce?: number
  gas?: bigint
  gasPrice?: bigint
  value?: bigint
  type: Hex
}

export type ShieldedWriteContractDebugResult<
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
> = {
  plaintextTx: PlaintextTransactionParameters
  shieldedTx: SendSeismicTransactionParameters<TChain, TAccount>
  txHash: Hash
}

/**
 * Creates a transaction for a shielded write. Returns both plaintext and shielded transaction versions. Useful for debugging.
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
 * @returns {ShieldedWriteContractDebugResult} Object containing both the plaintext and shielded transaction parameters.
 */
export async function shieldedWriteContractDebug<
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
  >,
  checkContractDeployed?: boolean,
  {
    blocksWindow = 100n,
    encryptionNonce: userEncNonce,
  }: SeismicSecurityParams = {}
): Promise<ShieldedWriteContractDebugResult<TChain, TAccount>> {
  if (checkContractDeployed) {
    const code = await client.getCode({ address: parameters.address })
    if (code === undefined) {
      throw new Error('Contract not found')
    }
  }
  const plaintextCalldata = getPlaintextCalldata(parameters)
  const request = await getShieldedWriteContractRequest(
    client,
    parameters,
    plaintextCalldata
  )
  const encryptionNonce = userEncNonce ?? randomEncryptionNonce()
  const metadata = await buildTxSeismicMetadata(client, {
    account: parameters.account || client.account,
    nonce: request.nonce,
    to: request.to!,
    value: request.value,
    encryptionNonce,
    blocksWindow,
    signedRead: false,
  })
  const txHash = await sendShieldedTransaction(client, request, {
    blocksWindow,
    encryptionNonce,
  })
  return {
    plaintextTx: {
      to: request.to || null,
      data: plaintextCalldata,
      type: numberToHex(SEISMIC_TX_TYPE),
      nonce: request.nonce,
      gas: request.gas,
      gasPrice: request.gasPrice,
      value: request.value,
    },
    shieldedTx: {
      type: numberToHex(SEISMIC_TX_TYPE),
      ...request,
      ...metadata.seismicElements,
    },
    txHash,
  }
}
