import { describe, expect, test } from 'bun:test'
import { encodeSeismicMetadataAsAAD, generateAesKey } from 'seismic-viem'
import { hexToBytes, bytesToHex } from 'viem'
import type { Hex } from 'viem'
import { gcm } from '@noble/ciphers/webcrypto'
import { secp256k1 } from '@noble/curves/secp256k1'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'

describe('Encrypt Calldata - TypeScript vs Rust', () => {
  test('should produce same ciphertext as Rust', async () => {
    console.log('\n=== TypeScript: Encrypting Calldata for Comparison with Rust ===\n')

    // MUST MATCH RUST TEST EXACTLY
    // Client secret key (for ECDH with network public key)
    const clientSecretKey: Hex = '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'

    // Network public key (for ECDH with client secret key)
    const networkPublicKey: Hex = '0x028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0'

    console.log('Client secret key:', clientSecretKey)
    console.log('Network public key:', networkPublicKey)

    // Plaintext calldata
    const plaintext: Hex = '0xdeadbeef'
    console.log('\nPlaintext calldata:', plaintext)

    // Encryption nonce (12 bytes, no leading zeros)
    const encryptionNonce: Hex = '0xec52a3363608e85a675ce99a'
    console.log('Encryption nonce:', encryptionNonce)

    // Transaction metadata (MUST MATCH RUST)
    const txMetadata = {
      chainId: 31337,
      nonce: 13n,
      gasPrice: 1419962928n,
      gas: 30000000n,
      to: '0x0000000000000000000000000000000000000001' as Hex,
      value: 1n,
      encryptionPubkey: networkPublicKey,
      encryptionNonce,
      messageVersion: 0,
      recentBlockHash: '0xe2b44b267afc1214aabb5aa349bb61b5832062bb2fc310adb2fd3107b725894f' as Hex,
      expiresAtBlock: 113n,
      signedRead: false,
    }

    console.log('\nTransaction metadata:')
    console.log('  chain_id:', txMetadata.chainId)
    console.log('  nonce:', txMetadata.nonce)
    console.log('  gas_price:', txMetadata.gasPrice)
    console.log('  gas:', txMetadata.gas)
    console.log('  to:', txMetadata.to)
    console.log('  value:', txMetadata.value)
    console.log('  encryption_pubkey:', txMetadata.encryptionPubkey)
    console.log('  encryption_nonce:', txMetadata.encryptionNonce)
    console.log('  message_version:', txMetadata.messageVersion)
    console.log('  recent_block_hash:', txMetadata.recentBlockHash)
    console.log('  expires_at_block:', txMetadata.expiresAtBlock)
    console.log('  signed_read:', txMetadata.signedRead)

    // 1. Generate AES key using ECDH
    const aesKey = generateAesKey({
      privateKey: clientSecretKey,
      networkPublicKey: networkPublicKey.slice(2), // Remove 0x prefix
    })
    console.log('\nAES key:', aesKey)

    // 2. Encode AAD
    const aad = encodeSeismicMetadataAsAAD(txMetadata)
    console.log('\nAAD:', bytesToHex(aad))
    console.log('AAD length:', aad.length, 'bytes')

    // 3. Encrypt using AES-GCM
    const key = hexToBytes(aesKey)
    const nonce = hexToBytes(encryptionNonce)
    const plaintextBytes = hexToBytes(plaintext)

    const ciphertext = await gcm(key, nonce, aad).encrypt(plaintextBytes)

    console.log('\n✅ TypeScript Encrypted calldata:', bytesToHex(ciphertext))
    console.log('✅ Ciphertext length:', ciphertext.length, 'bytes')

    // Verify decryption works
    const decrypted = await gcm(key, nonce, aad).decrypt(ciphertext)
    console.log('\n✅ Round-trip successful: decrypted back to', bytesToHex(decrypted))

    expect(bytesToHex(decrypted)).toBe(plaintext)

    // Now run the Rust test and compare the ciphertext values!
    console.log('\n⚠️  Run the Rust test: cargo test test_encrypt_calldata_rust_vs_typescript --package anvil-core -- --nocapture')
    console.log('⚠️  Compare the "Encrypted calldata" values from both tests - they should match!')
  })
})
