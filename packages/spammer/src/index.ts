import { expect } from 'bun:test'
import { http, parseGwei } from 'viem'

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

const testContractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`

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
  publicClient: ShieldedPublicClient
) => {
  // This is a seismic tx since the arg to setNumber is an suint
  const inputNumber = randomUnsigned256Bit()
  const tx1 = await seismicContract.write.setNumber([inputNumber], {
    gas: 210000n,
    gasPrice: parseGwei('20'),
  })
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 })
  const isOdd = await seismicContract.read.isOdd()
  expect(isOdd).toBe(inputNumber % 2n === 1n)
}

const testSeismicTx = async (privateKey: string, rpcUrl: string) => {
  const publicClient = createShieldedPublicClient({
    chain: seismicDevnet,
    transport: http(rpcUrl),
  })

  const walletClient = await createShieldedWalletClient({
    chain: seismicDevnet,
    transport: http(rpcUrl),
    privateKey: privateKey as `0x${string}`,
  })

  const deployTx = await walletClient.deployContract({
    abi: contractABI,
    bytecode: testContractBytecodeFormatted,
    gas: 210000n,
    gasPrice: parseGwei('20'),
  })
  await publicClient.waitForTransactionReceipt({ hash: deployTx })

  const deployedContractAddress = await getDeployedAddress(
    publicClient,
    walletClient.account.address
  )
  console.info(`Deployed contract address: ${deployedContractAddress}`)

  const seismicContract = getShieldedContract({
    abi: contractABI,
    address: deployedContractAddress,
    client: walletClient,
  })

  while (true) {
    console.time('SeismicTxExecutionTime')
    for (let i = 0; i < 10; i++) {
      await sendSeismicTx(seismicContract, publicClient)
    }
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
