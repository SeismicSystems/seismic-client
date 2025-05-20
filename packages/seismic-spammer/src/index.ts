import {
  ShieldedContract,
  ShieldedPublicClient,
  ShieldedWalletClient,
  createShieldedPublicClient,
  createShieldedWalletClient,
  getShieldedContract,
} from 'seismic-viem'
import { createPublicClient, http, parseGwei } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { Chain } from 'viem/chains'

import { seismicCounterAbi } from '@sviem-tests/tests/contract/abi.ts'
import { seismicCounterBytecode } from '@sviem-tests/tests/contract/bytecode.ts'

const testContractBytecodeFormatted: `0x${string}` = `0x${seismicCounterBytecode.object.replace(/^0x/, '')}`

const TX_CNT_PER_SPIKE = 10
const CALL_CNT_PER_SPIKE = 10

function getNewPrivateKey(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return (
    '0x' +
    Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
  )
}

async function getNonce(client: ShieldedWalletClient): Promise<bigint> {
  return BigInt(
    await client.getTransactionCount({
      address: client.account?.address,
    })
  )
}

function randomUnsigned256Bit(): bigint {
  // Create a Uint8Array of 32 bytes (256 bits)
  const byteArray = new Uint8Array(32)
  crypto.getRandomValues(byteArray) // Fill it with secure random values

  // Convert the byte array to a BigInt
  let randomBigInt = 0n
  for (const byte of byteArray) {
    randomBigInt = (randomBigInt << 8n) | BigInt(byte)
  }

  return randomBigInt // The random number is already within the 256-bit range
}

const sendSeismicTx = async (
  seismicContract: ShieldedContract,
  publicClient: ShieldedPublicClient,
  nonce: BigInt
) => {
  // This is a seismic tx since the arg to setNumber is an suint
  const inputNumber = randomUnsigned256Bit()
  const tx1 = await seismicContract.write.setNumber([inputNumber], {
    gas: 210000n,
    gasPrice: parseGwei('20'),
    nonce: nonce,
  })
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 })
  const isOdd1 = await seismicContract.read.isOdd()
}

const callSeismicTx = async (
  seismicContract: ShieldedContract,
  nonce: BigInt
) => {
  const isOdd1 = await seismicContract.read.isOdd([], {
    // @ts-ignore
    gas: 210000n,
    gasPrice: parseGwei('20'),
    nonce: nonce,
  })
}

async function detectChain(rpcUrl: string): Promise<Chain | null> {
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  })

  try {
    const chainId = await publicClient.getChainId()
    console.log(`Detected Chain ID: ${chainId}`)
    return {
      id: chainId,
      name: `Chain-${chainId}`,
      nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
      },
      rpcUrls: { default: { http: [rpcUrl] } },
    }
  } catch (error) {
    console.error('Error detecting chain:', error)
    return null
  }
}

const testSeismicTx = async (
  privateKey: string,
  detectedChain: Chain,
  rpcUrl: string
) => {
  const publicClient = await createShieldedPublicClient({
    chain: detectedChain,
    transport: http(rpcUrl),
  })
  const fundedWalletClient = await createShieldedWalletClient({
    chain: detectedChain,
    transport: http(rpcUrl),
    account: privateKeyToAccount(privateKey as `0x${string}`),
  })
  console.log('Getting Seismic Client for funded wallet...')

  const poorWalletClient = await createShieldedWalletClient({
    chain: detectedChain,
    transport: http(rpcUrl),
    account: privateKeyToAccount(getNewPrivateKey() as `0x${string}`),
  })

  console.log('Sending some ETH to the poor wallet...')

  // Transfer some ETH from fundedWalletClient to poorWalletClient
  const transferTx = await fundedWalletClient.sendTransaction({
    to: poorWalletClient.account.address,
    value: parseGwei('4300000'), // Adjust the amount as needed
    gas: 21000n,
    gasPrice: parseGwei('20'),
  })
  await publicClient.waitForTransactionReceipt({ hash: transferTx })

  // =========== wallet creation completion ===========

  const deployTx = await fundedWalletClient.deployContract({
    abi: seismicCounterAbi,
    bytecode: testContractBytecodeFormatted,
    gas: 210000n,
    gasPrice: parseGwei('20'),
  })
  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployTx,
  })
  const deployedContractAddress = deployReceipt.contractAddress!

  console.info(`Deployed contract address: ${deployedContractAddress}`)

  const fundedSeismicContract = getShieldedContract({
    abi: seismicCounterAbi,
    address: deployedContractAddress,
    client: fundedWalletClient,
  })

  const poorSeismicContract = getShieldedContract({
    abi: seismicCounterAbi,
    address: deployedContractAddress,
    client: poorWalletClient,
  })

  let fundedNonce = await getNonce(fundedWalletClient)
  let poorNonce = await getNonce(poorWalletClient)

  console.log('Starting Seismic Tx spamming...')
  console.log(`Funded Wallet Nonce: ${fundedNonce}`)
  console.log(`Poor Wallet Nonce: ${poorNonce}`)

  while (true) {
    console.time('SeismicTxExecutionTime')

    const promises = []

    for (let i = 0; i < TX_CNT_PER_SPIKE; i++) {
      promises.push(
        // @ts-ignore
        sendSeismicTx(fundedSeismicContract, publicClient, fundedNonce)
      ) // Start the async task
      fundedNonce = fundedNonce + 1n
    }
    for (let i = 0; i < CALL_CNT_PER_SPIKE; i++) {
      // @ts-ignore
      promises.push(callSeismicTx(poorSeismicContract, poorNonce))
    }

    await Promise.all(promises)

    console.timeEnd('SeismicTxExecutionTime')
    const randomDelay = Math.floor(Math.random() * 5000) + 1000 // Random delay between 1s to 6s
    await new Promise((resolve) => setTimeout(resolve, randomDelay))
  }
}

async function main() {
  const args = process.argv.slice(2) // Skip 'node' and script path

  let rpcUrl = ''
  let privateKey = ''

  args.forEach((arg) => {
    if (arg.startsWith('--rpc=')) {
      rpcUrl = arg.split('=')[1]
    } else if (arg.startsWith('--sk=')) {
      privateKey = arg.split('=')[1]
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey
      }
    }
  })

  if (!rpcUrl || !privateKey) {
    console.error('Error: Missing required arguments --rpc and/or --sk')
    process.exit(1) // Exit with failure
  }

  const detectedChain = await detectChain(rpcUrl)
  if (!detectedChain) {
    console.error('Error: Failed to detect chain')
    process.exit(1) // Exit with failure
  }

  console.log(`RPC URL: ${rpcUrl}`)
  console.log(`Private Key: ${privateKey}`)
  console.log(`ChainId: ${detectedChain.id}`)

  await testSeismicTx(privateKey, detectedChain, rpcUrl)
}
main()
