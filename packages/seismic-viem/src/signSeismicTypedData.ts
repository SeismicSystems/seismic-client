import { Account, Hex, TypedData, numberToHex, parseSignature } from 'viem'
import { SignTypedDataParameters, signTypedData } from 'viem/actions'

import {
  type TransactionSerializableSeismic,
  type TxSeismic,
  stringifyBigInt,
} from '@sviem/chain'
import type { ShieldedWalletClient } from '@sviem/client'

const seismicTxTypedData = <
  typedData extends TypedData | Record<string, unknown>,
  primaryType extends keyof typedData | 'EIP712Domain',
  account extends Account | undefined,
>(
  tx: TransactionSerializableSeismic
): SignTypedDataParameters<typedData, primaryType, account> => {
  if (!tx.chainId) {
    throw new Error('Seismic transactions require chainId argument')
  }

  const message: TxSeismic = {
    type: 0x4a,
    from: tx.from,
    chainId: tx.chainId,
    nonce: tx.nonce !== undefined ? BigInt(tx.nonce) : undefined,
    gasPrice: tx.gasPrice && BigInt(tx.gasPrice),
    gasLimit: tx.gas && BigInt(tx.gas),
    to: tx.to,
    value: tx.value && BigInt(tx.value),
    input: tx.data,
    encryptionPubkey: tx.encryptionPubkey,
  }
  console.log(JSON.stringify(message, stringifyBigInt, 2))
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
        { name: 'type', type: 'uint8' },
        { name: 'from', type: 'address' },
        { name: 'chainId', type: 'uint64' },
        { name: 'nonce', type: 'uint64' },
        { name: 'gasPrice', type: 'uint128' },
        { name: 'gasLimit', type: 'uint64' },
        // if blank, we assume it's a create
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'input', type: 'bytes' },
        // compressed secp256k1 public key (33 bytes)
        { name: 'encryptionPubkey', type: 'bytes' },
      ],
    },
    primaryType: 'TxSeismic',
    domain: {
      name: 'Seismic Transaction',
      version: '1',
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
  typedData extends TypedData | Record<string, unknown>,
  primaryType extends keyof typedData | 'EIP712Domain',
  account extends Account | undefined,
>(
  client: ShieldedWalletClient,
  tx: TransactionSerializableSeismic
): Promise<{
  typedData: SignTypedDataParameters<typedData, primaryType, account>
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
