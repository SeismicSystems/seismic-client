import type { Hex } from 'viem'

import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'
import { getSharedSecret } from '@noble/secp256k1'

const { createCipheriv, createDecipheriv } = require('crypto-browserify')

export class AesGcmCrypto {
  private readonly ALGORITHM = 'aes-256-gcm'
  private readonly TAG_LENGTH = 16 // Authentication tag length in bytes
  private readonly NONCE_LENGTH = 12 // 96 bits is the recommended nonce length for GCM
  private readonly U64_SIZE = 8 // Size of u64 in bytes

  constructor(private readonly key: Hex) {
    const keyBuffer = Buffer.from(key.slice(2), 'hex')
    if (keyBuffer.length !== 32) {
      throw new Error('Key must be 32 bytes (256 bits)')
    }
  }

  /**
   * Creates a nonce from a u64 number, matching Rust's implementation
   * @param num - The number to convert (will be treated as u64)
   */
  private numberToNonce(num: bigint | number): Buffer {
    let value = BigInt(num)

    // Create a buffer for the full nonce (12 bytes)
    const nonceBuffer = Buffer.alloc(this.NONCE_LENGTH, 0)

    // Write the u64 value in big-endian format to the first 8 bytes
    for (let i = this.U64_SIZE - 1; i >= 0; i--) {
      nonceBuffer[i] = Number(value & 0xffn)
      value = value >> 8n
    }

    // Last 4 bytes remain as zeros
    return nonceBuffer
  }

  /**
   * Validates and converts a hex nonce to buffer
   * @param nonce - The nonce in hex format
   */
  private validateAndConvertNonce(nonce: Hex): Buffer {
    const nonceBuffer = Buffer.from(nonce.slice(2), 'hex')
    if (nonceBuffer.length !== this.NONCE_LENGTH) {
      throw new Error('Nonce must be 12 bytes')
    }
    return nonceBuffer
  }

  /**
   * Creates a nonce from a number in a way compatible with the Rust backend
   */
  public createNonce(num: number | bigint): Hex {
    return `0x${this.numberToNonce(num).toString('hex')}` as Hex
  }

  /**
   * Encrypts data using either a number-based nonce or hex nonce
   */
  public encrypt(
    plaintext: Hex,
    nonce: number | bigint | Hex
  ): {
    ciphertext: Hex
  } {
    // Handle the nonce based on its type
    const nonceBuffer = new Uint8Array(
      typeof nonce === 'string'
        ? this.validateAndConvertNonce(nonce as Hex)
        : this.numberToNonce(nonce)
    )

    const key = new Uint8Array(Buffer.from(this.key.slice(2), 'hex'))
    const cipher = createCipheriv(this.ALGORITHM, key, nonceBuffer)

    const callData = new Uint8Array(Buffer.from(plaintext.slice(2), 'hex'))
    const ciphertext = Buffer.concat([
      new Uint8Array(cipher.update(callData)),
      new Uint8Array(cipher.final()),
      new Uint8Array(cipher.getAuthTag()),
    ])

    return {
      ciphertext: `0x${ciphertext.toString('hex')}` as Hex,
    }
  }

  /**
   * Decrypts data using either a number-based nonce or hex nonce
   */
  public decrypt(ciphertext: Hex, nonce: number | bigint | Hex): Hex {
    // Handle the nonce based on its type
    const nonceBuffer = new Uint8Array(
      typeof nonce === 'string'
        ? this.validateAndConvertNonce(nonce as Hex)
        : this.numberToNonce(nonce)
    )

    const ciphertextBuffer = new Uint8Array(
      Buffer.from(ciphertext.slice(2), 'hex')
    )

    // Extract the tag from the end (last 16 bytes)
    const tag = ciphertextBuffer.slice(-this.TAG_LENGTH)
    const encryptedData = ciphertextBuffer.slice(0, -this.TAG_LENGTH)

    const key = new Uint8Array(Buffer.from(this.key.slice(2), 'hex'))
    const decipher = createDecipheriv(this.ALGORITHM, key, nonceBuffer)

    // Set the auth tag
    decipher.setAuthTag(tag)

    // Decrypt the data
    const decrypted = new Uint8Array(
      Buffer.concat([
        new Uint8Array(decipher.update(encryptedData)),
        new Uint8Array(decipher.final()),
      ])
    )

    return `0x${Buffer.from(decrypted).toString('hex')}` as Hex
  }
}

type AesInputKeys = { privateKey: Hex; networkPublicKey: string }

export const sharedSecretPoint = ({
  privateKey,
  networkPublicKey,
}: AesInputKeys): Uint8Array => {
  const privateKeyHex = privateKey.startsWith('0x')
    ? privateKey.slice(2)
    : privateKey
  // return non-compressed point, stripping prefix (which will be 4)
  return getSharedSecret(privateKeyHex, networkPublicKey, false).slice(1)
}

export const sharedKeyFromPoint = (sharedSecret: Uint8Array): string => {
  // Get the last byte (index 63) and apply the bitwise operations
  const version = (sharedSecret[63] & 0x01) | 0x02
  // Extra (non-standard) stuff that Rust does
  // Create a buffer for version and x-coordinate
  const finalSecret = sha256
    .create()
    .update(new Uint8Array([version]))
    .update(sharedSecret.slice(0, 32))
    .digest()
  return Buffer.from(finalSecret).toString('hex')
}

export const generateSharedKey = (inputs: AesInputKeys): string => {
  const sharedSecret = sharedSecretPoint(inputs)
  return sharedKeyFromPoint(sharedSecret)
}

export const deriveAesKey = (sharedSecret: string): Hex => {
  const derivedKey = hkdf(
    sha256, // Hash function
    new Uint8Array(Buffer.from(sharedSecret, 'hex')), // Input key material (IKM) - shared secret
    new Uint8Array(0), // Salt
    new TextEncoder().encode('aes-gcm key'), // Info (optional context string)
    32 // Output length (32 bytes for AES-256)
  )
  const derivedKeyBuffer = Buffer.from(derivedKey)
  return `0x${derivedKeyBuffer.toString('hex')}`
}

export const generateAesKey = (aesKeys: AesInputKeys): Hex => {
  const sharedSecret = generateSharedKey(aesKeys)
  return deriveAesKey(sharedSecret)
}
