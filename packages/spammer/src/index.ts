import { http, parseGwei } from 'viem'

import {
  createShieldedPublicClient,
  createShieldedWalletClient,
  getShieldedContract,
  seismicDevnet,
} from '@sviem'

import { contractABI } from '../../../tests/seismic-viem/src/contract/abi'
import { bytecode } from '../../../tests/seismic-viem/src/contract/bytecode'
import {
  getDeployedAddress,
  stringifyBigInt,
} from '../../../tests/seismic-viem/src/utils'

const testContractBytecodeFormatted: `0x${string}` = `0x${bytecode.object.replace(/^0x/, '')}`

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

  const isOdd0 = await walletClient.readContract({
    address: deployedContractAddress,
    abi: contractABI,
    functionName: 'isOdd',
  })
  // const isOdd0 = await seismicContract.tread.isOdd()
  // contract initializes number to be 0
  // expect(isOdd0).toBe(false)
  console.info(`[0] initial value of isOdd = ${isOdd0}`)

  // This is a seismic tx since the arg to setNumber is an suint
  const input_number = Math.floor(Math.random() * 100)
  const tx1 = await seismicContract.write.setNumber([input_number], {
    gas: 210000n,
    gasPrice: parseGwei('20'),
  })
  console.info(`[1] Set number tx: ${tx1}`)
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 })
  console.info(
    `[1] setNumber receipt: ${JSON.stringify(receipt1, stringifyBigInt, 2)}`
  )

  // Try reading using explicit signedRead
  const isOdd1 = await seismicContract.read.isOdd()
  // number has been set to 11
  // expect(isOdd1).toBe(true)

  // Not a seismic tx since there are no arguments therefore no shielded arguments
  const tx2 = await seismicContract.write.increment([], {
    gas: 210000n,
    gasPrice: parseGwei('20'),
  })
  console.info(`[2] Incremented number in tx: ${tx2}`)
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 })
  console.info(
    `[2] Increment receipt: ${JSON.stringify(receipt2, stringifyBigInt, 2)}`
  )

  // Try reading using unsigned (normal) read
  const isOdd2 = await seismicContract.tread.isOdd()
  // expect(isOdd2).toBe(false)

  // This is a seismic tx since the arg to setNumber is an suint
  const tx3 = await seismicContract.write.setNumber([TEST_NUMBER], {
    gas: 210000n,
    gasPrice: parseGwei('20'),
  })
  console.info(`[3] Set number tx: ${tx1}`)
  const receipt3 = await publicClient.waitForTransactionReceipt({ hash: tx3 })
  console.info(
    `[3] setNumber receipt: ${JSON.stringify(receipt3, stringifyBigInt, 2)}`
  )

  // Use non-explicit signed-read
  const isOdd3 = await seismicContract.tread.isOdd([], {
    account: walletClient.account.address,
  })
  // number has been set back to 11
  // expect(isOdd3).toBe(true)
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
