import { Hex, bytesToHex } from 'viem'

import { secp256k1 } from '@noble/curves/secp256k1'

// Function to convert uncompressed public key to compressed format
export const compressPublicKey = (uncompressedKey: Hex): Hex => {
  // Remove '0x' prefix if present and ensure key is in proper format
  const cleanKey = uncompressedKey.replace('0x', '')

  // Ensure the key is valid length (65 bytes = 130 hex chars + optional 0x prefix)
  if (cleanKey.length !== 130) {
    throw new Error('Invalid uncompressed public key length')
  }

  const pt = secp256k1.ProjectivePoint.fromHex(cleanKey)
  return bytesToHex(pt.toRawBytes(true))
}
