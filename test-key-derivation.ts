import { createPublicClient, http, bytesToHex, hexToBytes } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { secp256k1 } from '@noble/curves/secp256k1'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha256'

// Import from seismic-viem
import { 
  sanvil, 
  createShieldedPublicClient,
  createShieldedWalletClient,
  getEncryption 
} from './packages/seismic-viem/src/index.ts'

// ============================================
// Copy the key derivation functions for manual testing
// ============================================

type AesInputKeys = { privateKey: `0x${string}`; networkPublicKey: string }

const sharedSecretPoint = ({
  privateKey,
  networkPublicKey,
}: AesInputKeys): Uint8Array => {
  const privateKeyHex = privateKey.startsWith('0x')
    ? privateKey.slice(2)
    : privateKey
  return secp256k1
    .getSharedSecret(privateKeyHex, networkPublicKey, false)
    .slice(1)
}

const sharedKeyFromPoint = (sharedSecret: Uint8Array): string => {
  const version = (sharedSecret[63] & 0x01) | 0x02
  const finalSecret = sha256
    .create()
    .update(new Uint8Array([version]))
    .update(sharedSecret.slice(0, 32))
    .digest()
  return bytesToHex(finalSecret).slice(2)
}

const generateSharedKey = (inputs: AesInputKeys): string => {
  const sharedSecret = sharedSecretPoint(inputs)
  return sharedKeyFromPoint(sharedSecret)
}

const deriveAesKey = (sharedSecret: string): `0x${string}` => {
  const derivedKey = hkdf(
    sha256,
    hexToBytes(`0x${sharedSecret}`),
    new Uint8Array(0),
    new TextEncoder().encode('aes-gcm key'),
    32
  )
  return bytesToHex(derivedKey) as `0x${string}`
}

const generateAesKeyManual = (aesKeys: AesInputKeys): `0x${string}` => {
  const sharedSecret = generateSharedKey(aesKeys)
  return deriveAesKey(sharedSecret)
}

// ============================================
// TEST SCRIPT AGAINST SANVIL
// ============================================

async function testKeyDerivation() {
  console.log('='.repeat(60))
  console.log('TEST: AES Key Derivation Against SANVIL')
  console.log('='.repeat(60))

  // Connect to sanvil
  console.log('\n📡 Connecting to sanvil at', sanvil.rpcUrls.default.http[0])
  
  const publicClient = createShieldedPublicClient({
    chain: sanvil,
    transport: http(),
  })

  // Get the TEE public key from the network
  console.log('\n--- Fetching TEE Public Key ---')
  const networkPublicKey = await publicClient.getTeePublicKey()
  console.log('TEE Public Key:', networkPublicKey)

  // ----------------------------------------
  // Test 1: Same encryptionPrivateKey → Same AES key (using getEncryption)
  // ----------------------------------------
  console.log('\n--- Test 1: getEncryption() with same key ---')
  
  const fixedEncryptionKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`
  
  const result1 = getEncryption(networkPublicKey, fixedEncryptionKey)
  const result2 = getEncryption(networkPublicKey, fixedEncryptionKey)
  const result3 = getEncryption(networkPublicKey, fixedEncryptionKey)
  
  console.log('Call 1 - AES Key:', result1.aesKey)
  console.log('Call 2 - AES Key:', result2.aesKey)
  console.log('Call 3 - AES Key:', result3.aesKey)
  console.log('All equal?', result1.aesKey === result2.aesKey && result2.aesKey === result3.aesKey ? '✅ YES' : '❌ NO')

  // ----------------------------------------
  // Test 2: getEncryption() WITHOUT providing key (random each time)
  // ----------------------------------------
  console.log('\n--- Test 2: getEncryption() WITHOUT providing key ---')
  
  const random1 = getEncryption(networkPublicKey)  // No key provided
  const random2 = getEncryption(networkPublicKey)  // No key provided
  
  console.log('Call 1 - encryptionPrivateKey:', random1.encryptionPrivateKey)
  console.log('Call 1 - AES Key:', random1.aesKey)
  console.log('Call 2 - encryptionPrivateKey:', random2.encryptionPrivateKey)
  console.log('Call 2 - AES Key:', random2.aesKey)
  console.log('Different keys?', random1.aesKey !== random2.aesKey ? '✅ YES (different - random each time!)' : '❌ NO')

  // ----------------------------------------
  // Test 3: Manual derivation matches getEncryption()
  // ----------------------------------------
  console.log('\n--- Test 3: Manual derivation vs getEncryption() ---')
  
  const testKey = generatePrivateKey()
  
  const fromGetEncryption = getEncryption(networkPublicKey, testKey)
  const fromManual = generateAesKeyManual({ privateKey: testKey, networkPublicKey })
  
  console.log('Test encryptionPrivateKey:', testKey)
  console.log('getEncryption() AES:', fromGetEncryption.aesKey)
  console.log('Manual derivation AES:', fromManual)
  console.log('Match?', fromGetEncryption.aesKey === fromManual ? '✅ YES' : '❌ NO')

  // ----------------------------------------
  // Test 4: Wallet client - same encryptionSk → same AES key
  // ----------------------------------------
  console.log('\n--- Test 4: Wallet client with same encryptionSk ---')
  
  const walletPrivateKey = generatePrivateKey()
  const walletAccount = privateKeyToAccount(walletPrivateKey)
  const encryptionSk = generatePrivateKey()  // Separate encryption key
  
  console.log('Wallet address:', walletAccount.address)
  console.log('encryptionSk:', encryptionSk)
  
  // Create wallet client twice with same encryptionSk
  const walletClient1 = await createShieldedWalletClient({
    chain: sanvil,
    transport: http(),
    account: walletAccount,
    encryptionSk: encryptionSk,
  })
  
  const walletClient2 = await createShieldedWalletClient({
    chain: sanvil,
    transport: http(),
    account: walletAccount,
    encryptionSk: encryptionSk,
  })
  
  const aesFromClient1 = walletClient1.getEncryption()
  const aesFromClient2 = walletClient2.getEncryption()
  
  console.log('Wallet Client 1 AES:', aesFromClient1)
  console.log('Wallet Client 2 AES:', aesFromClient2)
  console.log('Same AES key?', aesFromClient1 === aesFromClient2 ? '✅ YES' : '❌ NO')

  // ----------------------------------------
  // Test 5: Using wallet private key AS encryption key
  // ----------------------------------------
  console.log('\n--- Test 5: Using wallet private key as encryptionSk ---')
  
  const walletKey = generatePrivateKey()
  const wallet = privateKeyToAccount(walletKey)
  
  console.log('Wallet address:', wallet.address)
  console.log('Using wallet private key as encryptionSk...')
  
  // Create wallet client using wallet's own key for encryption
  const client1 = await createShieldedWalletClient({
    chain: sanvil,
    transport: http(),
    account: wallet,
    encryptionSk: walletKey,  // Using WALLET key!
  })
  
  const client2 = await createShieldedWalletClient({
    chain: sanvil,
    transport: http(),
    account: wallet,
    encryptionSk: walletKey,  // Same wallet key
  })
  
  console.log('Client 1 AES:', client1.getEncryption())
  console.log('Client 2 AES:', client2.getEncryption())
  console.log('Deterministic?', client1.getEncryption() === client2.getEncryption() ? '✅ YES' : '❌ NO')

  // ----------------------------------------
  // Test 6: Simulating session restart
  // ----------------------------------------
  console.log('\n--- Test 6: Simulating session restart ---')
  
  const userWalletKey = generatePrivateKey()
  const userWallet = privateKeyToAccount(userWalletKey)
  
  console.log('User wallet:', userWallet.address)
  
  // Session 1: NO encryptionSk provided (random)
  const session1 = await createShieldedWalletClient({
    chain: sanvil,
    transport: http(),
    account: userWallet,
    // encryptionSk NOT provided - will be random!
  })
  const session1Aes = session1.getEncryption()
  console.log('Session 1 (random encryptionSk) AES:', session1Aes)
  
  // Session 2: NO encryptionSk provided (new random)
  const session2 = await createShieldedWalletClient({
    chain: sanvil,
    transport: http(),
    account: userWallet,
    // encryptionSk NOT provided - will be NEW random!
  })
  const session2Aes = session2.getEncryption()
  console.log('Session 2 (random encryptionSk) AES:', session2Aes)
  
  console.log('Keys match?', session1Aes === session2Aes ? '✅ YES' : '❌ NO (Different! Cannot decrypt old txs!)')

  // Session 3: WITH encryptionSk = wallet key (deterministic)
  const session3 = await createShieldedWalletClient({
    chain: sanvil,
    transport: http(),
    account: userWallet,
    encryptionSk: userWalletKey,  // Use wallet key
  })
  const session3Aes = session3.getEncryption()
  console.log('Session 3 (encryptionSk = walletKey) AES:', session3Aes)
  
  // Session 4: Same - WITH encryptionSk = wallet key
  const session4 = await createShieldedWalletClient({
    chain: sanvil,
    transport: http(),
    account: userWallet,
    encryptionSk: userWalletKey,
  })
  const session4Aes = session4.getEncryption()
  console.log('Session 4 (encryptionSk = walletKey) AES:', session4Aes)
  
  console.log('Sessions 3 & 4 match?', session3Aes === session4Aes ? '✅ YES (Deterministic!)' : '❌ NO')

  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY:')
  console.log('- Same encryptionSk + Same TEE pubkey = Same AES key ✅')
  console.log('- No encryptionSk = Random each time ❌')
  console.log('- Solution: Pass encryptionSk (e.g., wallet private key)')
  console.log('='.repeat(60))
}

testKeyDerivation().catch(console.error)
