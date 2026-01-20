import { expect } from 'bun:test'
import {
  SEISMIC_TX_TYPE,
  TransactionSerializableSeismic,
  buildTxSeismicMetadata,
  createShieldedPublicClient,
  createShieldedWalletClient,
  getPlaintextCalldata,
  signSeismicTxTypedData,
  stringifyBigInt,
} from 'seismic-viem'
import { getShieldedContract } from 'seismic-viem'
import {
  Account,
  Chain,
  Hex,
  decodeFunctionResult,
  hexToNumber,
  parseGwei,
} from 'viem'
import { http } from 'viem'

import { seismicCounterAbi } from '@sviem-tests/tests/contract/abi.ts'
import { seismicCounterBytecode } from '@sviem-tests/tests/contract/bytecode.ts'

export type ContractTestArgs = {
  chain: Chain
  url: string
  account: Account
}

const expectSeismicTx = (typeHex: Hex | null) => {
  if (!typeHex) {
    throw new Error('Transaction type not found')
  } else {
    const txType = hexToNumber(typeHex)
    expect(txType).toBe(SEISMIC_TX_TYPE)
  }
}

export const testSeismicTx = async ({
  chain,
  url,
  account,
}: ContractTestArgs) => {
  const publicClient = createShieldedPublicClient({
    chain,
    transport: http(url),
  })
  const walletClient = await createShieldedWalletClient({
    chain,
    transport: http(url),
    account,
  })
  const testContractBytecodeFormatted: `0x${string}` = `0x${seismicCounterBytecode.object.replace(/^0x/, '')}`
  const TEST_NUMBER = BigInt(11)

  const deployTx = await walletClient.deployContract({
    abi: seismicCounterAbi,
    bytecode: testContractBytecodeFormatted,
    chain: walletClient.chain,
  })
  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployTx,
  })

  const deployedContractAddress = deployReceipt.contractAddress!
  console.info(`Deployed contract address: ${deployedContractAddress}`)

  const seismicContract = getShieldedContract({
    abi: seismicCounterAbi,
    address: deployedContractAddress,
    client: walletClient,
  })

  const isOdd0 = await walletClient.readContract({
    address: deployedContractAddress,
    abi: seismicCounterAbi,
    functionName: 'isOdd',
  })
  // contract initializes number to be 0
  expect(isOdd0).toBe(false)
  console.info(`[0] initial value of isOdd = ${isOdd0}`)

  const tx1 = await seismicContract.write.setNumber([TEST_NUMBER])
  console.info(`[1] Set number tx: ${tx1}`)
  const receipt1 = await publicClient.waitForTransactionReceipt({ hash: tx1 })
  console.info(
    `[1] setNumber receipt: ${JSON.stringify(receipt1, stringifyBigInt, 2)}`
  )
  expectSeismicTx(receipt1.type as `0x${string}` | null)

  console.log('[1] calling signed read...')
  // Try reading using explicit signedRead
  const isOdd1 = await seismicContract.read.isOdd()
  // number has been set to 11
  expect(isOdd1).toBe(true)

  console.log('[1] calling transparent read...')
  const isOdd1_tread = await seismicContract.tread.isOdd()
  expect(isOdd1_tread).toBe(true)

  // console.log('[2] calling write contract...')
  const tx2 = await walletClient.writeContract({
    address: deployedContractAddress,
    abi: seismicCounterAbi,
    functionName: 'increment',
  })
  console.info(`[2] Incremented number in tx: ${tx2}`)
  const receipt2 = await publicClient.waitForTransactionReceipt({ hash: tx2 })
  console.info(
    `[2] Increment receipt: ${JSON.stringify(receipt2, stringifyBigInt, 2)}`
  )
  expectSeismicTx(receipt2.type as `0x${string}` | null)

  // Try reading using unsigned (normal) read
  const isOdd2 = await seismicContract.tread.isOdd()
  expect(isOdd2).toBe(false)

  console.log('[3] calling dwrite...')
  const {
    txHash: dwriteHash1,
    plaintextTx,
    shieldedTx,
  } = await seismicContract.dwrite.setNumber([TEST_NUMBER])
  const receiptDw1 = await publicClient.waitForTransactionReceipt({
    hash: dwriteHash1,
  })

  console.log('[3] calling dwriteContract...')
  const { plaintextTx: dwritePlaintextTx, txHash: dwriteHash2 } =
    await walletClient.dwriteContract({
      address: deployedContractAddress,
      abi: seismicCounterAbi,
      functionName: 'setNumber',
      args: [TEST_NUMBER],
    })
  expect(dwritePlaintextTx.data).toBe(plaintextTx.data)

  console.info(`[3] Set number tx: ${tx1}`)
  console.info(
    `[3] Plaintext tx: ${JSON.stringify(plaintextTx, stringifyBigInt, 2)}`
  )
  console.info(
    `[3] Shielded tx: ${JSON.stringify(shieldedTx, stringifyBigInt, 2)}`
  )
  const receiptDw2 = await publicClient.waitForTransactionReceipt({
    hash: dwriteHash2,
  })
  console.info(
    `[3] setNumber receipt: ${JSON.stringify(receiptDw2, stringifyBigInt, 2)}`
  )
  expectSeismicTx(receiptDw2.type as `0x${string}` | null)

  console.log(`[3] Using non-explicit signed read...`)
  // Use non-explicit signed-read
  const isOdd3 = await seismicContract.tread.isOdd({
    account: walletClient.account.address,
  })
  // number has been set back to 11
  expect(isOdd3).toBe(true)

  console.log('[4] Signing using typed data tx...')
  /* 
  TODO: turn these into utility functions
  */
  // Sign a tx using typed data transaction
  // @ts-expect-error: this is fine
  const plaintextWrite = getPlaintextCalldata({
    abi: seismicCounterAbi,
    functionName: 'increment',
  })
  const writeMetadata = await buildTxSeismicMetadata(walletClient, {
    account,
    nonce: await walletClient.getTransactionCount({
      address: walletClient.account.address,
    }),
    to: deployedContractAddress,
    typedDataTx: true,
  })
  const writeCiphertext = await walletClient.encrypt(
    plaintextWrite,
    writeMetadata
  )
  const typedDataWriteTx: TransactionSerializableSeismic = {
    type: 'seismic',
    nonce: writeMetadata.legacyFields.nonce,
    chainId: walletClient.chain.id,
    to: deployedContractAddress,
    gas: 1_000_000n,
    gasPrice: parseGwei('100'),
    data: writeCiphertext,
    ...writeMetadata.seismicElements,
  }
  const signedTdWrite = await signSeismicTxTypedData(
    walletClient,
    typedDataWriteTx
  )

  const tdHash = await walletClient.sendRawTransaction({
    // @ts-expect-error: this is fine
    serializedTransaction: {
      data: signedTdWrite.typedData,
      signature: signedTdWrite.signature,
    },
  })
  const tdReceipt = await walletClient.waitForTransactionReceipt({
    hash: tdHash,
  })
  expect(tdReceipt.status).toBe('success')

  const plaintextRead = getPlaintextCalldata({
    abi: seismicCounterAbi,
    // @ts-expect-error: this is fine
    functionName: 'isOdd',
  })
  const readMetadata = await buildTxSeismicMetadata(walletClient, {
    account,
    nonce: await walletClient.getTransactionCount({
      address: walletClient.account.address,
    }),
    to: deployedContractAddress,
    signedRead: true,
    typedDataTx: true,
  })
  const ciphertext = await walletClient.encrypt(plaintextRead, readMetadata)
  const typedDataReadTx: TransactionSerializableSeismic = {
    type: 'seismic',
    nonce: await walletClient.getTransactionCount({
      address: walletClient.account.address,
    }),
    chainId: walletClient.chain.id,
    to: deployedContractAddress,
    gas: 1_000_000n,
    gasPrice: parseGwei('100'),
    data: ciphertext,
    ...readMetadata.seismicElements,
  }
  const signedTdRead = await signSeismicTxTypedData(
    walletClient,
    typedDataReadTx
  )
  // @ts-expect-error: this is fine
  const tdResponse: Hex = await walletClient.publicRequest({
    method: 'eth_call',
    params: [
      { data: signedTdRead.typedData, signature: signedTdRead.signature },
    ],
  })
  const tdPlaintext = await walletClient.decrypt(tdResponse, readMetadata)
  const isOdd4 = decodeFunctionResult({
    abi: seismicCounterAbi,
    functionName: 'isOdd',
    args: [],
    data: tdPlaintext || '0x',
  })
  expect(isOdd4).toBe(false)
}
