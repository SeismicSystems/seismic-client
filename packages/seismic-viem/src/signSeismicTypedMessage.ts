import { Account, Hex, TypedData } from 'viem'
import { SignTypedDataParameters, signTypedData } from 'viem/actions'

import type { TransactionSerializableSeismic, TxSeismic } from '@sviem/chain'
import type { ShieldedWalletClient } from '@sviem/client'
import { toYParitySignatureArray } from '@sviem/viem-internal/signature'

const seismicTypedTxMessage = <
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
    chainId: tx.chainId,
    nonce: tx.nonce !== undefined ? BigInt(tx.nonce) : undefined,
    gasPrice: tx.gasPrice && BigInt(tx.gasPrice),
    gasLimit: tx.gas && BigInt(tx.gas),
    to: tx.to,
    value: tx.value && BigInt(tx.value),
    input: tx.data,
    encryption_pubkey: tx.encryptionPubkey,
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
        { name: 'input', type: 'bytes' },
        // compressed secp256k1 public key
        { name: 'encryptionPublicKey', type: 'bytes' },
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

export const signSeismicTypedMessage = async (
  client: ShieldedWalletClient,
  tx: TransactionSerializableSeismic
): Promise<{
  message: TxSeismic
  signature: { r: Hex; s: Hex; yParity: Hex }
}> => {
  const typedMessage = seismicTypedTxMessage(tx)
  // @ts-ignore
  const message: TxSeismic = typedMessage.message
  const encodedSignature = await signTypedData(client, typedMessage)
  //   const action = getAction(client, signTypedData, 'signTypedData')
  //   const signature = await action(message)
  // @ts-ignore
  const [yParity, r, s] = toYParitySignatureArray(undefined, encodedSignature)
  const signature = { r, s, yParity }
  return { message, signature }
}
