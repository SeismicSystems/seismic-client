import { expect } from 'bun:test'
import { createHash } from 'crypto'
import {
  createShieldedPublicClient,
  createShieldedWalletClient,
} from 'seismic-viem'
import { Account, Chain, parseEther } from 'viem'
import { http } from 'viem'

import { depositContractAbi } from '@sviem-tests/tests/contract/depositContractAbi.ts'
import { depositContractBytecode } from '@sviem-tests/tests/contract/depositContractBytecode.ts'

export type ContractTestArgs = {
  chain: Chain
  url: string
  account: Account
}

const VALIDATOR_MINIMUM_STAKE = 32n
const WITHDRAWAL_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

function generateWithdrawalCredentials(address: `0x${string}`): `0x${string}` {
  // Format: 0x01 || 0x00...00 (11 bytes) || execution_address (20 bytes)
  const credentials = new Uint8Array(32)
  credentials[0] = 0x01 // ETH1 withdrawal prefix
  // Bytes 1-11 remain zero
  // Set the last 20 bytes to the withdrawal address
  const addressBytes = new Uint8Array(Buffer.from(address.slice(2), 'hex'))
  credentials.set(addressBytes, 12)

  return `0x${Buffer.from(credentials).toString('hex')}` as `0x${string}`
}

function generateValidatorData() {
  const nodePubkey = `0x${'00'.repeat(32)}` as `0x${string}`

  const consensusPubkey = `0x${'11'.repeat(48)}` as `0x${string}`

  const withdrawalCredentials =
    generateWithdrawalCredentials(WITHDRAWAL_ADDRESS)

  const nodeSignature = `0x${'33'.repeat(64)}` as `0x${string}`

  const consensusSignature = `0x${'44'.repeat(96)}` as `0x${string}`

  const depositDataRoot = computeDepositDataRoot(
    nodePubkey,
    consensusPubkey,
    withdrawalCredentials,
    nodeSignature,
    consensusSignature,
    parseEther(VALIDATOR_MINIMUM_STAKE.toString())
  )

  return {
    nodePubkey,
    consensusPubkey,
    withdrawalCredentials,
    nodeSignature,
    consensusSignature,
    depositDataRoot,
  }
}

function computeDepositDataRoot(
  nodePubkey: `0x${string}`,
  consensusPubkey: `0x${string}`,
  withdrawalCredentials: `0x${string}`,
  nodeSignature: `0x${string}`,
  consensusSignature: `0x${string}`,
  amount: bigint
): `0x${string}` {
  // Convert hex strings to buffers
  const nodePubkeyBytes = Buffer.from(nodePubkey.slice(2), 'hex')
  const consensusPubkeyBytes = Buffer.from(consensusPubkey.slice(2), 'hex')
  const withdrawalCredentialsBytes = Buffer.from(
    withdrawalCredentials.slice(2),
    'hex'
  )
  const nodeSignatureBytes = Buffer.from(nodeSignature.slice(2), 'hex')
  const consensusSignatureBytes = Buffer.from(
    consensusSignature.slice(2),
    'hex'
  )

  // consensus_pubkey_hash = sha256(consensus_pubkey || bytes16(0))
  const consensusPubkeyHash = createHash('sha256')
    .update(consensusPubkeyBytes)
    .update(Buffer.alloc(16, 0)) // bytes16(0)
    .digest()

  // pubkey_root = sha256(node_pubkey || consensus_pubkey_hash)
  const pubkeyRoot = createHash('sha256')
    .update(nodePubkeyBytes)
    .update(consensusPubkeyHash)
    .digest()

  // node_signature_hash = sha256(node_signature)
  const nodeSignatureHash = createHash('sha256')
    .update(nodeSignatureBytes)
    .digest()

  // consensus_signature_hash = sha256(sha256(consensus_signature[0:64]) || sha256(consensus_signature[64:96] || bytes32(0)))
  const consensusSigPart1 = createHash('sha256')
    .update(consensusSignatureBytes.slice(0, 64))
    .digest()

  const consensusSigPart2 = createHash('sha256')
    .update(consensusSignatureBytes.slice(64, 96))
    .update(Buffer.alloc(32, 0)) // bytes32(0)
    .digest()

  const consensusSignatureHash = createHash('sha256')
    .update(consensusSigPart1)
    .update(consensusSigPart2)
    .digest()

  // signature_root = sha256(node_signature_hash || consensus_signature_hash)
  const signatureRoot = createHash('sha256')
    .update(nodeSignatureHash)
    .update(consensusSignatureHash)
    .digest()

  // Convert amount to 8-byte little-endian (gwei)
  const amountGwei = amount / BigInt(10 ** 9) // Convert wei to gwei
  const amountBytes = Buffer.alloc(8)
  amountBytes.writeBigUInt64LE(amountGwei, 0)

  // node = sha256(sha256(pubkey_root || withdrawal_credentials) || sha256(amount || bytes24(0) || signature_root))
  const leftNode = createHash('sha256')
    .update(pubkeyRoot)
    .update(withdrawalCredentialsBytes)
    .digest()

  const rightNode = createHash('sha256')
    .update(amountBytes)
    .update(Buffer.alloc(24, 0)) // bytes24(0)
    .update(signatureRoot)
    .digest()

  const depositDataRoot = createHash('sha256')
    .update(leftNode)
    .update(rightNode)
    .digest()

  return `0x${depositDataRoot.toString('hex')}` as `0x${string}`
}

export const testDepositContract = async ({
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

  const testContractBytecodeFormatted: `0x${string}` = `0x${depositContractBytecode.object.replace(/^0x/, '')}`

  const deployTx = await walletClient.deployContract({
    abi: depositContractAbi,
    bytecode: testContractBytecodeFormatted,
    chain: walletClient.chain,
  })
  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployTx,
  })

  const deployedContractAddress = deployReceipt.contractAddress!

  const initialDepositRoot = await publicClient.getDepositRoot({
    address: deployedContractAddress,
  })
  expect(initialDepositRoot).toBeDefined()
  expect(typeof initialDepositRoot).toBe('string')

  const initialDepositCount = await publicClient.getDepositCount({
    address: deployedContractAddress,
  })
  expect(initialDepositCount).toBeDefined()

  const validatorData = generateValidatorData()

  const initialAccountBalance = await publicClient.getBalance({
    address: account.address,
  })

  const depositTx = await walletClient.deposit({
    address: deployedContractAddress,
    nodePubkey: validatorData.nodePubkey,
    consensusPubkey: validatorData.consensusPubkey,
    withdrawalCredentials: validatorData.withdrawalCredentials,
    nodeSignature: validatorData.nodeSignature,
    consensusSignature: validatorData.consensusSignature,
    depositDataRoot: validatorData.depositDataRoot,
    value: parseEther(VALIDATOR_MINIMUM_STAKE.toString()),
  })

  expect(depositTx).toBeDefined()
  const depositReceipt = await publicClient.waitForTransactionReceipt({
    hash: depositTx,
  })
  expect(depositReceipt.status).toBe('success')

  expect(depositReceipt.logs.length).toBeGreaterThan(0)

  const finalAccountBalance = await publicClient.getBalance({
    address: account.address,
  })

  const contractBalance = await publicClient.getBalance({
    address: deployedContractAddress,
  })

  const balanceDifference = initialAccountBalance - finalAccountBalance
  const expectedDeposit = parseEther(VALIDATOR_MINIMUM_STAKE.toString())

  expect(contractBalance).toBe(expectedDeposit)

  expect(balanceDifference).toBeGreaterThanOrEqual(expectedDeposit)

  const newDepositCount = await publicClient.getDepositCount({
    address: deployedContractAddress,
  })
  expect(newDepositCount).toBeDefined()

  const newDepositRoot = await publicClient.getDepositRoot({
    address: deployedContractAddress,
  })
  expect(newDepositRoot).toBeDefined()
  expect(typeof newDepositRoot).toBe('string')

  return {
    deployedContractAddress,
    initialDepositRoot,
    initialDepositCount,
    depositTx,
    depositReceipt,
    newDepositCount,
    newDepositRoot,
    validatorData,
    initialAccountBalance,
    finalAccountBalance,
    contractBalance,
  }
}
