import { describe, test } from 'bun:test'
import { createShieldedWalletClient, seismicDevnet } from 'seismic-viem'
import { http, parseAbi, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Hex } from 'viem'

describe('Send Encrypted Transaction', () => {
  test('send transaction to backend and verify decryption', async () => {
    console.log('\n=== Sending Encrypted Transaction to Backend ===\n')

    // Use the same private key as the comparison test
    const clientSecretKey: Hex = '0x311d54d3bf8359c70827122a44a7b4458733adce3c51c6b59d9acfce85e07505'

    // Create account for signing the transaction
    const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') // anvil account #0

    console.log('Client encryption SK:', clientSecretKey)
    console.log('Transaction signer:', account.address)

    // Create shielded wallet client
    const client = await createShieldedWalletClient({
      chain: seismicDevnet,
      transport: http('http://127.0.0.1:8545'),
      account,
      encryptionSk: clientSecretKey,
    })

    console.log('Network public key:', client.getEncryptionPublicKey())

    // Simple contract ABI for testing
    const abi = parseAbi([
      'function testFunction(uint256 value) public returns (uint256)',
    ])

    const contractAddress = '0x0000000000000000000000000000000000000001' as Hex

    console.log('\nSending transaction...')
    console.log('Contract address:', contractAddress)
    console.log('Function: testFunction(1337)')
    console.log('Expected plaintext calldata should be function selector + encoded uint256')

    try {
      const hash = await client.writeContract({
        address: contractAddress,
        abi,
        functionName: 'testFunction',
        args: [1337n],
        gas: 30000000n,
        gasPrice: 1419962928n,
      })

      console.log('\n✅ Transaction sent!')
      console.log('Transaction hash:', hash)
      console.log('\n⚠️  Check anvil logs for decrypted calldata')
      console.log('⚠️  The backend should print the decrypted calldata')
    } catch (error) {
      console.error('\n❌ Transaction failed:', error)
      throw error
    }
  }, { timeout: 30000 })
})
