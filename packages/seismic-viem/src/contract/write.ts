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
import { getChainId, prepareTransactionRequest } from 'viem/actions'

import { SEISMIC_TX_TYPE, encodeSeismicMetadataAsAAD } from '@sviem/chain.ts'
import type { ShieldedWalletClient } from '@sviem/client.ts'
import { remapSeismicAbiInputs } from '@sviem/contract/abi.ts'
import { AesGcmCrypto } from '@sviem/crypto/aes.ts'
import { randomEncryptionNonce } from '@sviem/crypto/nonce.ts'
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
  plaintextCalldata: Hex,
  blocksWindow: bigint = 100n
): Promise<SendSeismicTransactionParameters<TChain, TAccount>> {
  const { address, gas, gasPrice, value, nonce } = parameters

  // Prepare transaction to get all metadata fields
  const chainId = await getChainId(client)
  const preparedTx = await prepareTransactionRequest(client, {
    to: address,
    data: plaintextCalldata,
    nonce,
    value,
    gas,
    gasPrice,
    from: client.account?.address,
    type: 'legacy',
  } as any)

  // Get the most recent block info
  const recentBlock = await client.getBlock({ blockTag: 'latest' })
  const recentBlockHash = recentBlock.hash!
  const expiresAtBlock = recentBlock.number! + blocksWindow

  const encryptionPubkey = client.getEncryptionPublicKey()
  const encryptionNonce = randomEncryptionNonce()

  // Encode metadata as AAD for authenticated encryption
  const aad = encodeSeismicMetadataAsAAD({
    chainId,
    nonce: preparedTx.nonce!,
    gasPrice: preparedTx.gasPrice!,
    gas: preparedTx.gas!,
    to: preparedTx.to!,
    value: preparedTx.value ?? 0n,
    encryptionPubkey,
    encryptionNonce,
    messageVersion: 0,
    recentBlockHash,
    expiresAtBlock,
    signedRead: false,
  })

  const aesKey = client.getEncryption()
  const aesCipher = new AesGcmCrypto(aesKey)
  const data = await aesCipher.encrypt(plaintextCalldata, encryptionNonce, aad)

  return {
    account: client.account,
    chain: undefined,
    to: address,
    data,
    nonce: preparedTx.nonce,
    value: preparedTx.value,
    gas: preparedTx.gas,
    gasPrice: preparedTx.gasPrice,
    encryptionPubkey,
    encryptionNonce,
    recentBlockHash,
    expiresAtBlock,
    signedRead: false,
  }
}

/**
 * Executes a shielded write function on a contract, where the calldata is encrypted. The API for this is the same as viem's {@link https://viem.sh/docs/contract/writeContract writeContract}
 *
 *
 * @param {ShieldedWalletClient} client - The client to use.
 * @param {ShieldedWriteContractParameters} parameters - The configuration object for the write operation.
 *   - `address` ({@link Hex}) - The address of the contract.
 *   - `abi` ({@link Abi}) - The contract's ABI.
 *   - `functionName` (string) - The name of the contract function to call.
 *   - `args` (array) - The arguments to pass to the contract function.
 *   - `gas` (bigint, optional) - Optional gas limit for the transaction.
 *   - `gasPrice` (bigint, optional) - Optional gas price for the transaction.
 *   - `value` (bigint, optional) - Optional value (native token amount) to send with the transaction.
 *   - `blocksWindow` (bigint, optional) - Number of blocks until transaction expires (default: 100n).
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
 *   blocksWindow: 200n, // Optional: transaction valid for 200 blocks
 * })
 */
export type ShieldedWriteContractParameters<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'nonpayable' | 'payable', TFunctionName>,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
  TChainOverride extends Chain | undefined = Chain | undefined,
> = WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, TChainOverride> & {
  blocksWindow?: bigint
}

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
  parameters: ShieldedWriteContractParameters<
    TAbi,
    TFunctionName,
    TArgs,
    TChain,
    TAccount,
    chainOverride
  >
): Promise<WriteContractReturnType> {
  const { blocksWindow = 100n, ...writeParams } = parameters
  const plaintextCalldata = getPlaintextCalldata(writeParams as WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, chainOverride>)
  const request = await getShieldedWriteContractRequest(
    client,
    writeParams as WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, chainOverride>,
    plaintextCalldata,
    blocksWindow
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
 * @param {ShieldedWriteContractDebugParameters} parameters - The configuration object for the write operation.
 *   - `address` ({@link Hex}) - The address of the contract.
 *   - `abi` ({@link Abi}) - The contract's ABI.
 *   - `functionName` (string) - The name of the contract function to call.
 *   - `args` (array) - The arguments to pass to the contract function.
 *   - `gas` (bigint, optional) - Optional gas limit for the transaction.
 *   - `gasPrice` (bigint, optional) - Optional gas price for the transaction.
 *   - `value` (bigint, optional) - Optional value (native token amount) to send with the transaction.
 *   - `checkContractDeployed` (boolean, optional) - Whether to check if contract is deployed.
 *   - `blocksWindow` (bigint, optional) - Number of blocks until transaction expires (default: 100n).
 *
 * @returns {ShieldedWriteContractDebugResult} Object containing both the plaintext and shielded transaction parameters.
 */
export type ShieldedWriteContractDebugParameters<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>,
  TArgs extends ContractFunctionArgs<TAbi, 'nonpayable' | 'payable', TFunctionName>,
  TChain extends Chain | undefined = Chain | undefined,
  TAccount extends Account | undefined = Account | undefined,
  TChainOverride extends Chain | undefined = Chain | undefined,
> = ShieldedWriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, TChainOverride> & {
  checkContractDeployed?: boolean
}

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
  parameters: ShieldedWriteContractDebugParameters<
    TAbi,
    TFunctionName,
    TArgs,
    TChain,
    TAccount,
    chainOverride
  >
): Promise<ShieldedWriteContractDebugResult<TChain, TAccount>> {
  const { checkContractDeployed, blocksWindow = 100n, ...writeParams } = parameters

  if (checkContractDeployed) {
    const code = await client.getCode({ address: parameters.address })
    if (code === undefined) {
      throw new Error('Contract not found')
    }
  }
  const plaintextCalldata = getPlaintextCalldata(writeParams as WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, chainOverride>)
  const request = await getShieldedWriteContractRequest(
    client,
    writeParams as WriteContractParameters<TAbi, TFunctionName, TArgs, TChain, TAccount, chainOverride>,
    plaintextCalldata,
    blocksWindow
  )
  const txHash = await sendShieldedTransaction(client, request)
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
    shieldedTx: { ...request, type: numberToHex(SEISMIC_TX_TYPE) },
    txHash,
  }
}
