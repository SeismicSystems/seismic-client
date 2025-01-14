import { expect } from 'bun:test'
import { http, parseGwei } from 'viem'
import { getTransactionCount } from 'viem/actions'

import {
  ShieldedContract,
  ShieldedPublicClient,
  ShieldedWalletClient,
  createShieldedPublicClient,
  createShieldedWalletClient,
  getShieldedContract,
  seismicDevnet,
} from '@sviem/index'

import { contractABI } from '../../../tests/seismic-viem/src/contract/abi'
import { bytecode } from '../../../tests/seismic-viem/src/contract/bytecode'
import {
  getDeployedAddress,
  stringifyBigInt,
} from '../../../tests/seismic-viem/src/utils'
import { getSeismicClients } from '../../seismic-viem/src/client'

const testContractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`

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

async function getNonce(client: ShieldedWalletClient): BigInt {
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
    gas: 210000n,
    gasPrice: parseGwei('20'),
    nonce: nonce,
  })
}

const testSeismicTx = async (privateKey: string, rpcUrl: string) => {
  const seismicClient = await getSeismicClients({
    chain: seismicDevnet,
    transport: http(rpcUrl),
    privateKey: privateKey as `0x${string}`,
  })
  const fundedPublicClient = seismicClient.public
  const fundedWalletClient = seismicClient.wallet

  const newSeismicClient = await getSeismicClients({
    chain: seismicDevnet,
    transport: http(rpcUrl),
    privateKey: getNewPrivateKey() as `0x${string}`,
  })
  const poorPublicClient = newSeismicClient.public
  const poorWalletClient = newSeismicClient.wallet

  // Transfer some ETH from fundedWalletClient to poorWalletClient
  const transferTx = await fundedWalletClient.sendTransaction({
    to: poorWalletClient.account.address,
    value: parseGwei('4300000'), // Adjust the amount as needed
    gas: 21000n,
    gasPrice: parseGwei('20'),
  })
  await fundedPublicClient.waitForTransactionReceipt({ hash: transferTx })

  // =========== wallet creation completion ===========

  const deployTx = await fundedWalletClient.deployContract({
    abi: contractABI,
    bytecode: testContractBytecodeFormatted,
    gas: 210000n,
    gasPrice: parseGwei('20'),
  })
  await fundedPublicClient.waitForTransactionReceipt({ hash: deployTx })

  const deployedContractAddress = await getDeployedAddress(
    fundedPublicClient,
    fundedWalletClient.account.address
  )
  console.info(`Deployed contract address: ${deployedContractAddress}`)

  const fundedSeismicContract = getShieldedContract({
    abi: contractABI,
    address: deployedContractAddress,
    client: fundedWalletClient,
  })

  const poorSeismicContract = getShieldedContract({
    abi: contractABI,
    address: deployedContractAddress,
    client: poorWalletClient,
  })

  let fundedNonce = await getNonce(fundedWalletClient)
  let poorNonce = await getNonce(poorWalletClient)

  while (true) {
    console.time('SeismicTxExecutionTime')
    const promises = []

    for (let i = 0; i < TX_CNT_PER_SPIKE; i++) {
      promises.push(
        sendSeismicTx(fundedSeismicContract, fundedPublicClient, fundedNonce)
      ) // Start the async task
      fundedNonce = fundedNonce + 1n
    }
    for (let i = 0; i < CALL_CNT_PER_SPIKE; i++) {
      promises.push(callSeismicTx(poorSeismicContract, poorNonce))
    }

    await Promise.all(promises) // Wait for all async tasks to complete
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
    }
  })

  if (!rpcUrl || !privateKey) {
    console.error('Error: Missing required arguments --rpc and/or --sk')
    process.exit(1) // Exit with failure
  }

  console.log(`RPC URL: ${rpcUrl}`)
  console.log(`Private Key: ${privateKey}`)

  await testSeismicTx(privateKey, rpcUrl)
}
main()
