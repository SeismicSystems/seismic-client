import { Hex, toHex, toRlp } from 'viem'

import { TxSeismicMetadata } from '@sviem/metadata.ts'

/**
 * Encodes transaction metadata as Additional Authenticated Data (AAD) for AEAD encryption
 * Encodes all fields as a single RLP list for easy decoding
 * This matches the Rust implementation in TxSeismicMetadata::encode_as_aad
 */
export const encodeSeismicMetadataAsAAD = ({
  sender,
  legacyFields: { chainId, nonce, to, value },
  seismicElements: {
    encryptionPubkey,
    encryptionNonce,
    messageVersion = 0,
    recentBlockHash,
    expiresAtBlock,
    signedRead,
  },
}: TxSeismicMetadata): Uint8Array => {
  // Encode all 11 fields as a single RLP list
  const fields: Hex[] = [
    sender,
    toHex(chainId),
    nonce === 0 ? '0x' : toHex(nonce),
    to ?? '0x',
    value === 0n ? '0x' : toHex(value),
    encryptionPubkey,
    encryptionNonce === '0x00' || encryptionNonce === '0x0'
      ? '0x'
      : encryptionNonce,
    messageVersion === 0 ? '0x' : toHex(messageVersion),
    recentBlockHash,
    toHex(expiresAtBlock),
    signedRead ? '0x01' : '0x',
  ]
  return toRlp(fields as any, 'bytes')
}
