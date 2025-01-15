import { type Hex, bytesToHex, hexToBytes } from 'viem'

import { gcm } from '@noble/ciphers/webcrypto'
import { secp256k1 } from '@noble/curves/secp256k1'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'

const { createCipheriv, createDecipheriv } = require('crypto-browserify')

export class AesGcmCrypto {
  private readonly ALGORITHM = 'aes-256-gcm'
  private readonly TAG_LENGTH = 16 // Authentication tag length in bytes
  private readonly NONCE_LENGTH = 12 // 96 bits is the recommended nonce length for GCM
  private readonly U64_SIZE = 8 // Size of u64 in bytes

  constructor(private readonly key: Hex) {
    const keyBuffer = hexToBytes(key)
    if (keyBuffer.length !== 32) {
      throw new Error('Key must be 32 bytes (256 bits)')
    }
  }

  /**
   * Creates a nonce from a u64 number, matching Rust's implementation
   * @param num - The number to convert (will be treated as u64)
   */
  private numberToNonce(num: bigint | number): Uint8Array {
    let value = BigInt(num)

    // Create a buffer for the full nonce (12 bytes)
    const nonceBuffer = new Uint8Array(this.NONCE_LENGTH)
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
  private validateAndConvertNonce(nonce: Hex): Uint8Array {
    const nonceBuffer = hexToBytes(nonce)
    if (nonceBuffer.length !== this.NONCE_LENGTH) {
      throw new Error('Nonce must be 12 bytes')
    }
    return nonceBuffer
  }

  /**
   * Creates a nonce from a number in a way compatible with the Rust backend
   */
  public createNonce(num: number | bigint): Hex {
    return bytesToHex(this.numberToNonce(num))
  }

  /**
   * Encrypts data using either a number-based nonce or hex nonce
   */
  public async encrypt(
    plaintext: Hex,
    nonce: number | bigint | Hex
  ): Promise<{
    ciphertext: Hex
  }> {
    console.log('inside encrypt. building noncebuffer')
    // Handle the nonce based on its type
    const nonceBuffer = new Uint8Array(
      typeof nonce === 'string'
        ? this.validateAndConvertNonce(nonce as Hex)
        : this.numberToNonce(nonce)
    )
    console.log('hextobytes(key)')

    const key = hexToBytes(this.key)
    console.log('hextobytes(calldata)')
    const callData = hexToBytes(plaintext)

    console.log('creating cipher')
    const ciphertext = await gcm(key, nonceBuffer).encrypt(callData)

    // const cipher = createCipheriv(this.ALGORITHM, key, nonceBuffer)

    // console.log('ciphertext uint8')
    // const ciphertext = new Uint8Array([
    //   ...new Uint8Array(cipher.update(callData)),
    //   ...new Uint8Array(cipher.final()),
    //   ...new Uint8Array(cipher.getAuthTag()),
    // ])
    console.log('bytestohex(ciphertext)')
    return {
      ciphertext: bytesToHex(ciphertext),
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

    const ciphertextBuffer = hexToBytes(ciphertext)
    // Extract the tag from the end (last 16 bytes)
    const tag = ciphertextBuffer.slice(-this.TAG_LENGTH)
    const encryptedData = ciphertextBuffer.slice(0, -this.TAG_LENGTH)

    const key = hexToBytes(this.key)
    const decipher = createDecipheriv(this.ALGORITHM, key, nonceBuffer)

    // Set the auth tag
    decipher.setAuthTag(tag)

    // Decrypt the data
    const decrypted = new Uint8Array([
      ...new Uint8Array(decipher.update(encryptedData)),
      ...new Uint8Array(decipher.final()),
    ])

    return bytesToHex(decrypted)
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
  return secp256k1
    .getSharedSecret(privateKeyHex, networkPublicKey, false)
    .slice(1)
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
  return bytesToHex(finalSecret).slice(2)
}

export const generateSharedKey = (inputs: AesInputKeys): string => {
  const sharedSecret = sharedSecretPoint(inputs)
  return sharedKeyFromPoint(sharedSecret)
}

export const deriveAesKey = (sharedSecret: string): Hex => {
  const derivedKey = hkdf(
    sha256, // Hash function
    hexToBytes(`0x${sharedSecret}`),
    new Uint8Array(0), // Salt
    new TextEncoder().encode('aes-gcm key'), // Info (optional context string)
    32 // Output length (32 bytes for AES-256)
  )
  return bytesToHex(derivedKey)
}

export const generateAesKey = (aesKeys: AesInputKeys): Hex => {
  const sharedSecret = generateSharedKey(aesKeys)
  return deriveAesKey(sharedSecret)
}
