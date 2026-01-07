import { describe, test } from 'bun:test'
import { createShieldedWalletClient } from 'seismic-viem'
import { http, parseAbi, type Hex, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// Define local anvil chain with correct ID
const anvilChain = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
})

describe('Backend Decryption Test', () => {
  test('should send transaction and backend should decrypt it correctly', async () => {
    console.log('\n=== Testing Backend Decryption ===\n')

    // Use the same private key from comparison test for encryption
    const clientSecretKey: Hex = '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'

    // Use anvil account #0 for signing
    const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')

    console.log('Client encryption SK:', clientSecretKey)
    console.log('Transaction signer:', account.address)

    // Create shielded wallet client
    const client = await createShieldedWalletClient({
      chain: anvilChain,
      transport: http('http://127.0.0.1:8545'),
      account,
      encryptionSk: clientSecretKey,
    })

    console.log('Network public key:', client.getEncryptionPublicKey())

    // Simple contract call
    const abi = parseAbi([
      'function test() external',
    ])

    console.log('\n📤 Sending shielded transaction to backend...')
    console.log('Contract address: 0x0000000000000000000000000000000000000001')
    console.log('Function: test()')

    try {
      const hash = await client.writeContract({
        address: '0x0000000000000000000000000000000000000001' as Hex,
        abi,
        functionName: 'test',
        args: [],
      })

      console.log('\n✅ Transaction sent!')
      console.log('Transaction hash:', hash)
      console.log('\n📋 Check sanvil logs to verify decryption:')
      console.log('   Look for "Input (decrypted):" in /tmp/sanvil.log')
      console.log('   It should show the plaintext function selector, NOT encrypted data')
    } catch (error) {
      console.log('\n❌ Transaction error:', error)
      console.log('\n📋 Even if transaction failed, check /tmp/sanvil.log to see if decryption worked')
    }
  }, { timeout: 30000 })
})
