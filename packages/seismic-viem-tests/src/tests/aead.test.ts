import { describe, expect, test } from 'bun:test'
import { encodeSeismicMetadataAsAAD } from 'seismic-viem'
import { hexToBytes, bytesToHex, toHex } from 'viem'
import type { Hex } from 'viem'

// Import AEAD encryption functions
// We'll need to check if these exist in seismic-viem
import { secp256k1 } from '@noble/curves/secp256k1'
import { chacha20poly1305 } from '@noble/ciphers/chacha'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'

/**
 * ECDH encryption using ChaCha20-Poly1305 AEAD
 * This should match the Rust implementation in seismic-enclave
 */
function ecdhEncryptAead(
  theirPublicKey: Hex,
  ourSecretKey: Hex,
  plaintext: Hex,
  nonce: Uint8Array,
  aad: Uint8Array
): Hex {
  // 1. Compute shared secret using ECDH
  const theirPubKeyBytes = hexToBytes(theirPublicKey)
  const ourSecKeyBytes = hexToBytes(ourSecretKey)

  // Multiply their public key by our secret key to get shared point
  const sharedPoint = secp256k1.getSharedSecret(ourSecKeyBytes, theirPubKeyBytes, true)
  console.log('  Shared point (compressed):', bytesToHex(sharedPoint))

  // 2. Derive encryption key using HKDF
  // Use the x-coordinate of the shared point (skip the prefix byte)
  const sharedSecret = sharedPoint.slice(1)
  console.log('  Shared secret (x-coord):', bytesToHex(sharedSecret))

  // HKDF with SHA-256
  const encryptionKey = hkdf(sha256, sharedSecret, undefined, undefined, 32)
  console.log('  Encryption key:', bytesToHex(encryptionKey))

  // 3. Encrypt using ChaCha20-Poly1305 (12-byte nonce)
  const plaintextBytes = hexToBytes(plaintext)
  const cipher = chacha20poly1305(encryptionKey, nonce, aad)
  const ciphertext = cipher.encrypt(plaintextBytes)

  return bytesToHex(ciphertext)
}

/**
 * ECDH decryption using ChaCha20-Poly1305 AEAD
 */
function ecdhDecryptAead(
  theirPublicKey: Hex,
  ourSecretKey: Hex,
  ciphertext: Hex,
  nonce: Uint8Array,
  aad: Uint8Array
): Hex {
  // 1. Compute shared secret using ECDH
  const theirPubKeyBytes = hexToBytes(theirPublicKey)
  const ourSecKeyBytes = hexToBytes(ourSecretKey)

  const sharedPoint = secp256k1.getSharedSecret(ourSecKeyBytes, theirPubKeyBytes, true)

  // 2. Derive encryption key using HKDF
  const sharedSecret = sharedPoint.slice(1)
  const encryptionKey = hkdf(sha256, sharedSecret, undefined, undefined, 32)

  // 3. Decrypt using ChaCha20-Poly1305 (12-byte nonce)
  const ciphertextBytes = hexToBytes(ciphertext)
  const cipher = chacha20poly1305(encryptionKey, nonce, aad)
  const plaintext = cipher.decrypt(ciphertextBytes)

  return bytesToHex(plaintext)
}

describe('AEAD Encryption/Decryption', () => {
  test('should match Rust encryption/decryption', () => {
    console.log('\n=== Testing AEAD Encryption/Decryption (TypeScript) ===\n')

    // Fixed secret key - must match Rust test
    const secretKey: Hex = '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'
    console.log('Secret Key:', secretKey)

    // Fixed plaintext - must match Rust test
    const plaintext: Hex = '0xdeadbeef'
    console.log('Plaintext:', plaintext)

    // Transaction parameters - must match Rust test exactly
    const txParams = {
      chainId: 31337,
      nonce: 2n,
      gasPrice: 1000000000n,
      gas: 100000n,
      to: '0xd3e8763675e4c425df46cc3b5c0f6cbdac396046' as Hex,
      value: 1000000000000000n,
      encryptionPubkey: '0x028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0' as Hex,
      encryptionNonce: '0x00' as Hex,
      messageVersion: 0,
      recentBlockHash: '0xe3e59282e5c8e00876114bb9a9912e98682670da653fa53059de0f0cf2b80878' as Hex,
      expiresAtBlock: 18446744073709551615n,
      signedRead: false,
    }

    console.log('\nTransaction metadata:')
    console.log('  chain_id:', txParams.chainId)
    console.log('  nonce:', txParams.nonce)
    console.log('  gas_price:', txParams.gasPrice)
    console.log('  gas:', txParams.gas)
    console.log('  to:', txParams.to)
    console.log('  value:', txParams.value)
    console.log('  encryption_pubkey:', txParams.encryptionPubkey)
    console.log('  encryption_nonce:', txParams.encryptionNonce)
    console.log('  message_version:', txParams.messageVersion)
    console.log('  recent_block_hash:', txParams.recentBlockHash)
    console.log('  expires_at_block:', txParams.expiresAtBlock)
    console.log('  signed_read:', txParams.signedRead)

    // Encode AAD
    const aad = encodeSeismicMetadataAsAAD(txParams)
    const aadHex = bytesToHex(aad)
    console.log('\nAAD (Additional Authenticated Data):', aadHex)
    console.log('AAD length:', aad.length, 'bytes')

    // Expected AAD from Rust test
    const expectedAad = '0x827a6902843b9aca00830186a094d3e8763675e4c425df46cc3b5c0f6cbdac39604687038d7ea4c68000a1028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a08080a0e3e59282e5c8e00876114bb9a9912e98682670da653fa53059de0f0cf2b8087888ffffffffffffffff80'
    expect(aadHex).toBe(expectedAad)
    console.log('✅ AAD matches Rust output!')

    // Convert encryption nonce to Uint8Array (12 bytes for U96)
    const nonceBytes = new Uint8Array(12)
    // encryptionNonce is 0x00, which should be all zeros

    console.log('\nNonce bytes:', bytesToHex(nonceBytes))

    // Encrypt the plaintext
    const ciphertext = ecdhEncryptAead(
      txParams.encryptionPubkey,
      secretKey,
      plaintext,
      nonceBytes,
      aad
    )
    console.log('\nCiphertext:', ciphertext)
    console.log('Ciphertext length:', hexToBytes(ciphertext).length, 'bytes')

    // Expected ciphertext from Rust test
    const expectedCiphertext = '0xb382d8d46bf4839e15982033cf59aa51d7d6d08e'
    expect(ciphertext).toBe(expectedCiphertext)
    console.log('✅ Ciphertext matches Rust output!')

    // Decrypt the ciphertext
    const decrypted = ecdhDecryptAead(
      txParams.encryptionPubkey,
      secretKey,
      ciphertext,
      nonceBytes,
      aad
    )
    console.log('\nDecrypted:', decrypted)

    // Verify round trip
    expect(decrypted).toBe(plaintext)
    console.log('\n✅ AEAD encryption/decryption round trip successful!')
    console.log('✅ TypeScript implementation matches Rust!')
  })
})
