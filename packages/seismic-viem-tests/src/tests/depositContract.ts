import { expect } from 'bun:test'
import {
  createShieldedPublicClient,
  createShieldedWalletClient,
} from 'seismic-viem'
import { http, parseEther } from 'viem'
import type { Account, Chain } from 'viem'

export type DepositContractTestArgs = {
  chain: Chain
  url: string
  account: Account
  depositContractAddress: `0x${string}`
}

export type DepositTestData = {
  nodePubkey: `0x${string}`
  consensusPubkey: `0x${string}`
  withdrawalCredentials: `0x${string}`
  nodeSignature: `0x${string}`
  consensusSignature: `0x${string}`
  depositDataRoot: `0x${string}`
  value: bigint
}

export type DepositTestResult = {
  depositRoot?: string
  depositCount?: string
  depositTx?: string
  receipt?: any
  error?: string
}

const generateMockNodePubkey = (): `0x${string}` => `0x${'00'.repeat(32)}`
const generateMockConsensusPubkey = (): `0x${string}` => `0x${'11'.repeat(48)}`
const generateMockWithdrawalCredentials = (): `0x${string}` => `0x${'22'.repeat(32)}`
const generateMockNodeSignature = (): `0x${string}` => `0x${'33'.repeat(64)}`
const generateMockConsensusSignature = (): `0x${string}` => `0x${'44'.repeat(96)}`
const generateMockDepositDataRoot = (): `0x${string}` => `0x${'55'.repeat(32)}`
const getStandardDepositAmount = (): bigint => parseEther('32')

export const getMockDepositData = (): DepositTestData => ({
  nodePubkey: generateMockNodePubkey(),
  consensusPubkey: generateMockConsensusPubkey(),
  withdrawalCredentials: generateMockWithdrawalCredentials(),
  nodeSignature: generateMockNodeSignature(),
  consensusSignature: generateMockConsensusSignature(),
  depositDataRoot: generateMockDepositDataRoot(),
  value: getStandardDepositAmount(),
})

const createPublicClient = (chain: Chain, url: string) => 
  createShieldedPublicClient({
    chain,
    transport: http(url),
  })

const createWalletClient = async (chain: Chain, url: string, account: Account) =>
  createShieldedWalletClient({
    chain,
    transport: http(url),
    account,
  })

const validateDepositRoot = (depositRoot: unknown): void => {
  expect(depositRoot).toBeDefined()
  expect(typeof depositRoot).toBe('string')
  expect(depositRoot).toMatch(/^0x[0-9a-fA-F]{64}$/)
}

const validateDepositCount = (depositCount: unknown): void => {
  expect(depositCount).toBeDefined()
}

const validateTransactionHash = (txHash: unknown): void => {
  expect(txHash).toBeDefined()
  expect(typeof txHash).toBe('string')
  expect(txHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
}

export const testDepositContractReads = async ({
  chain,
  url,
  depositContractAddress,
}: DepositContractTestArgs): Promise<DepositTestResult> => {
  const publicClient = createPublicClient(chain, url)

  const depositRoot = await publicClient.getDepositRoot({
    address: depositContractAddress,
  })
  validateDepositRoot(depositRoot)

  const depositCount = await publicClient.getDepositCount({
    address: depositContractAddress,
  })
  validateDepositCount(depositCount)
  
  return { 
    depositRoot: depositRoot as string, 
    depositCount: depositCount as string 
  }
}

const validateTransactionReceipt = (receipt: any): void => {
  expect(receipt.status).toBe('success')
}

const executeDeposit = async (
  walletClient: any,
  depositContractAddress: `0x${string}`,
  depositData: DepositTestData
): Promise<string> => {
  return walletClient.deposit({
    address: depositContractAddress,
    ...depositData,
  })
}

const waitForTransaction = async (
  publicClient: any,
  txHash: string
): Promise<any> => {
  return publicClient.waitForTransactionReceipt({
    hash: txHash,
  })
}

export const testDepositContractWrites = async ({
  chain,
  url,
  account,
  depositContractAddress,
}: DepositContractTestArgs): Promise<DepositTestResult> => {
  try {
    const walletClient = await createWalletClient(chain, url, account)
    const publicClient = createPublicClient(chain, url)
    const mockData = getMockDepositData()
    
    const depositTx = await executeDeposit(walletClient, depositContractAddress, mockData)
    validateTransactionHash(depositTx)
    
    const receipt = await waitForTransaction(publicClient, depositTx)
    validateTransactionReceipt(receipt)
    
    return { depositTx, receipt }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { error: errorMessage }
  }
}

export const testDepositContract = async (
  args: DepositContractTestArgs
): Promise<{ reads: DepositTestResult; writes: DepositTestResult }> => {
  const reads = await testDepositContractReads(args)
  const writes = await testDepositContractWrites(args)
  
  return { reads, writes }
}

export const validateDepositContract = async ({
  chain,
  url,
  depositContractAddress,
}: Omit<DepositContractTestArgs, 'account'>): Promise<boolean> => {
  try {
    const publicClient = createPublicClient(chain, url)
    await publicClient.getDepositRoot({
      address: depositContractAddress,
    })
    return true
  } catch {
    return false
  }
}
