import { describe, test } from 'bun:test'
import { encodeSeismicMetadataAsAAD, generateAesKey, serializeSeismicTransaction } from 'seismic-viem'
import { hexToBytes, bytesToHex, createWalletClient, http } from 'viem'
import type { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { gcm } from '@noble/ciphers/webcrypto'

describe('Send Comparison Transaction', () => {
  test('send the exact comparison transaction to backend', async () => {
    console.log('\n=== Sending Exact Comparison Transaction to Backend ===\n')

    // EXACT SAME PARAMETERS AS COMPARISON TEST
    const clientSecretKey: Hex = '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'
    const networkPublicKey: Hex = '0x028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0'
    const plaintext: Hex = '0xdeadbeef'
    const encryptionNonce: Hex = '0xec52a3363608e85a675ce99a'

    console.log('Client secret key:', clientSecretKey)
    console.log('Network public key:', networkPublicKey)
    console.log('Plaintext calldata:', plaintext)
    console.log('Encryption nonce:', encryptionNonce)

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

    // 1. Generate AES key
    const aesKey = generateAesKey({
      privateKey: clientSecretKey,
      networkPublicKey: networkPublicKey.slice(2),
    })
    console.log('\nAES key:', aesKey)

    // 2. Encode AAD
    const aad = encodeSeismicMetadataAsAAD(txMetadata)
    console.log('AAD:', bytesToHex(aad))

    // 3. Encrypt calldata
    const key = hexToBytes(aesKey)
    const nonce = hexToBytes(encryptionNonce)
    const plaintextBytes = hexToBytes(plaintext)
    const ciphertext = await gcm(key, nonce, aad).encrypt(plaintextBytes)
    const encryptedData = bytesToHex(ciphertext)

    console.log('\nEncrypted calldata:', encryptedData)
    console.log('Expected:', '0x4700efcf39abdb50558c889a3ff85343f0d765aa')
    console.log('Match:', encryptedData === '0x4700efcf39abdb50558c889a3ff85343f0d765aa')

    // 4. Create and sign transaction
    const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') // anvil account #0
    console.log('\nTransaction signer:', account.address)

    const client = createWalletClient({
      account,
      transport: http('http://127.0.0.1:8545'),
    })

    // Build the seismic transaction
    const seismicTx = {
      chainId: txMetadata.chainId,
      nonce: txMetadata.nonce,
      gasPrice: txMetadata.gasPrice,
      gas: txMetadata.gas,
      to: txMetadata.to,
      value: txMetadata.value,
      data: encryptedData,
      encryptionPubkey: txMetadata.encryptionPubkey,
      encryptionNonce: txMetadata.encryptionNonce,
      messageVersion: txMetadata.messageVersion,
      recentBlockHash: txMetadata.recentBlockHash,
      expiresAtBlock: txMetadata.expiresAtBlock,
      signedRead: txMetadata.signedRead,
      type: 'seismic' as const,
    }

    // Serialize and sign
    const serialized = await account.signTransaction(seismicTx, {
      serializer: serializeSeismicTransaction,
    })

    console.log('\nSerialized transaction:', serialized)
    console.log('Length:', serialized.length / 2 - 1, 'bytes')

    // Send raw transaction
    try {
      console.log('\nSending transaction...')
      const hash = await client.request({
        method: 'eth_sendRawTransaction',
        params: [serialized],
      })

      console.log('\n✅ Transaction sent!')
      console.log('Transaction hash:', hash)
      console.log('\n⚠️  Check anvil logs for decrypted calldata')
      console.log('⚠️  Backend should decrypt to: 0xdeadbeef')
    } catch (error: any) {
      console.error('\n❌ Transaction failed:', error.message)
      if (error.data) {
        console.error('Error data:', error.data)
      }
      throw error
    }
  }, { timeout: 30000 })
})
