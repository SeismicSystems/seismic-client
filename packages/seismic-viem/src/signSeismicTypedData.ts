import {
  Account,
  Chain,
  Client,
  Hex,
  Transport,
  TypedData,
  numberToHex,
  parseSignature,
} from 'viem'
import { SignTypedDataParameters, signTypedData } from 'viem/actions'

import {
  type TransactionSerializableSeismic,
  type TxSeismic,
} from '@sviem/chain.ts'

// reserve 0 for normal seismic tx
// reserve 1 for personal_sign (ledger/trezor compatible)
export const TYPED_DATA_MESSAGE_VERSION: number = 2

const seismicTxTypedData = <
  typedData extends TypedData | Record<string, unknown>,
  primaryType extends keyof typedData | 'EIP712Domain',
  account extends Account | undefined,
>(
  tx: TransactionSerializableSeismic
): SignTypedDataParameters<typedData, primaryType, account> => {
  if (tx.chainId === undefined) {
    throw new Error('Seismic transactions require chainId argument')
  }
  if (tx.encryptionPubkey === undefined) {
    throw new Error('Seismic transactions require encryptionPubkey argument')
  }
  if (tx.encryptionNonce === undefined) {
    throw new Error('Seismic transactions require encryptionNonce argument')
  }
  if (tx.recentBlockHash === undefined) {
    throw new Error('Seismic transactions require recentBlockHash')
  }
  if (tx.expiresAtBlock === undefined) {
    throw new Error('Seismic transactions require expiresAtBlock')
  }
  if (tx.signedRead === undefined) {
    throw new Error('Seismic transactions require signedRead')
  }

  const message: TxSeismic = {
    chainId: tx.chainId,
    nonce: tx.nonce !== undefined ? BigInt(tx.nonce) : undefined,
    gasPrice: tx.gasPrice && BigInt(tx.gasPrice),
    gasLimit: tx.gas && BigInt(tx.gas),
    to: tx.to,
    value: tx.value ? BigInt(tx.value) : 0n,
    input: tx.data ?? '0x',
    encryptionPubkey: tx.encryptionPubkey,
    encryptionNonce: tx.encryptionNonce,
    messageVersion: TYPED_DATA_MESSAGE_VERSION,
    recentBlockHash: tx.recentBlockHash,
    expiresAtBlock: tx.expiresAtBlock,
    signedRead: tx.signedRead,
  }

  // @ts-ignore
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TxSeismic: [
        { name: 'chainId', type: 'uint64' },
        { name: 'nonce', type: 'uint64' },
        { name: 'gasPrice', type: 'uint128' },
        { name: 'gasLimit', type: 'uint64' },
        // if blank, we assume it's a create
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        // compressed secp256k1 public key (33 bytes)
        { name: 'input', type: 'bytes' },
        { name: 'encryptionPubkey', type: 'bytes' },
        { name: 'encryptionNonce', type: 'uint96' },
        { name: 'messageVersion', type: 'uint8' },
        { name: 'recentBlockHash', type: 'bytes32' },
        { name: 'expiresAtBlock', type: 'uint64' },
        { name: 'signedRead', type: 'bool' },
      ],
    },
    primaryType: 'TxSeismic',
    domain: {
      name: 'Seismic Transaction',
      version: `${TYPED_DATA_MESSAGE_VERSION}`,
      chainId: tx.chainId,
      // no verifying contract since this happens in RPC
      verifyingContract: '0x0000000000000000000000000000000000000000',
    },
    message,
  }
}

type PrimitiveSignature = {
  r: Hex
  s: Hex
  yParity: Hex
}

export const signSeismicTxTypedData = async <
  TTransport extends Transport,
  TChain extends Chain | undefined,
  TAccount extends Account,
  typedData extends TypedData | Record<string, unknown>,
  primaryType extends keyof typedData | 'EIP712Domain',
>(
  client: Client<TTransport, TChain, TAccount>,
  tx: TransactionSerializableSeismic
): Promise<{
  typedData: SignTypedDataParameters<typedData, primaryType, TAccount>
  signature: PrimitiveSignature
}> => {
  const typedData = seismicTxTypedData(tx)
  const encodedSignature = await signTypedData(client, typedData)
  const { r, s, yParity } = parseSignature(encodedSignature)
  return {
    // @ts-ignore
    typedData,
    signature: {
      r,
      s,
      yParity: numberToHex(yParity),
    },
  }
}
