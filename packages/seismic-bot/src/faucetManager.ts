import type {
  Address,
  Chain,
  Hash,
  Hex,
  LocalAccount,
  PublicClient,
  TransactionSerializable,
  TransactionSerializableLegacy,
} from 'viem'
import { createPublicClient, formatUnits, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import SlackNotifier from '@sbot/slack'
import {
  type ShieldedWalletClient,
  createShieldedWalletClient,
} from '@sviem/client'
import { stringifyBigInt } from '@sviem/utils.ts'

const MIN_ETH_REFILL = 10_000
const REFILL_AMOUNT_ETH = 20_000

const formatUnitsRounded = (
  value: bigint,
  decimals: number = 18,
  places: number = 1
) => {
  const formatted = formatUnits(value, decimals)
  const [integer, fraction] = formatted.split('.')
  if (!fraction) {
    return formatted
  }
  return `${integer}.${fraction.slice(0, places)}`
}

type NonceString = string
type PoolResponse = {
  pending: Record<NonceString, TransactionSerializable>
  queued: Record<NonceString, TransactionSerializable>
}

const pickNonces = (
  txs: Record<NonceString, TransactionSerializable>
): number[] =>
  Object.entries(txs)
    .map(([nonce, tx]) => parseInt(nonce))
    .sort((a, b) => a - b)

const getMissingNonces = async (
  publicClient: PublicClient,
  address: Address
): Promise<number[]> => {
  const confirmedNonce = await publicClient.getTransactionCount({
    address,
    blockTag: 'latest',
  })
  const pool: PoolResponse = await publicClient.request({
    // @ts-expect-error: this is okay
    method: 'txpool_contentFrom',
    params: [address],
  })
  const queuedNonces = pickNonces(pool.queued)
  const minQueuedNonce = Math.min(...queuedNonces)
  const missingNonces: number[] = []
  for (let i = confirmedNonce; i < minQueuedNonce; i++) {
    missingNonces.push(i)
  }
  return missingNonces
}

export class FaucetManager {
  private node: string
  private chain: Chain
  private faucetAccount: LocalAccount
  private faucetReserveAccount: LocalAccount
  private publicClient: PublicClient
  private slack: SlackNotifier
  private extraAddresses: Address[]

  constructor(
    node: string,
    chain: Chain,
    faucetPrivateKey: Hex,
    faucetReservePrivateKey: Hex,
    slack: SlackNotifier,
    extraAddresses: Address[] = []
  ) {
    this.node = node
    this.chain = chain
    this.faucetAccount = privateKeyToAccount(faucetPrivateKey)
    this.faucetReserveAccount = privateKeyToAccount(faucetReservePrivateKey)
    this.publicClient = createPublicClient({ chain, transport: http() })
    this.slack = slack
    this.extraAddresses = extraAddresses
  }

  private getFaucetAddress(): Address {
    return this.faucetAccount.address
  }

  /**
   * Returns a wallet client using the faucet private key.
   */
  private async getFaucetWallet(): Promise<ShieldedWalletClient> {
    return createShieldedWalletClient({
      chain: this.chain,
      transport: http(),
      account: this.faucetAccount,
    })
  }

  /**
   * Returns a wallet client using the reserve private key.
   */
  private async getReserveWallet(): Promise<ShieldedWalletClient> {
    return createShieldedWalletClient({
      chain: this.chain,
      transport: http(),
      account: this.faucetReserveAccount,
    })
  }

  /**
   * Retrieves the faucet balance and logs it.
   */
  private async getBalance(address: Address): Promise<bigint> {
    return await this.publicClient.getBalance({
      address,
    })
  }

  /**
   * Funds the faucet if its balance is below 100 ETH (in wei).
   */
  private async fundAddressIfNeeded(address: Address) {
    const originalBalance = await this.getBalance(address)
    if (originalBalance < parseEther(MIN_ETH_REFILL.toString(), 'wei')) {
      console.log(
        `${this.node}/${address} balance is too low, sending ${REFILL_AMOUNT_ETH} eth`
      )
      const response = await this.slack.faucet({
        message: `Faucet balance on ${this.node} for ${address} is ${formatUnitsRounded(originalBalance)}. Topping up...`,
      })
      const reserveWallet = await this.getReserveWallet()
      const tx = await reserveWallet.sendTransaction({
        to: address,
        value: parseEther(REFILL_AMOUNT_ETH.toString(), 'wei'),
        chain: this.chain,
      })
      await this.publicClient.waitForTransactionReceipt({ hash: tx })
      const newBalance = await this.getBalance(address)
      this.slack.faucet({
        message: `Faucet balance on ${this.node} for ${address} is now ${formatUnitsRounded(newBalance)}`,
        threadTs: response.ts,
      })
    }
  }

  /**
   * Retrieves and returns the confirmed and pending nonce for the faucet address.
   * @param client - The public client for the chain.
   *
   * Note: We request pending nonce first intentionally,
   *       because it gives slightly more time for any pending txs
   *       to be included in the next block.
   *       When we check if we're up to date, we allow the confimed nonce
   *       to be ahead of the pending nonce (but not behind)
   */
  private async getNonces() {
    const pending = await this.publicClient.getTransactionCount({
      address: this.faucetAccount.address,
      blockTag: 'pending',
    })
    // sleep for the length of the block time
    await Bun.sleep(4_000)
    const confirmed = await this.publicClient.getTransactionCount({
      address: this.faucetAccount.address,
    })
    return { confirmed, pending }
  }

  /**
   * Sends a test transaction using the faucet wallet if there is a nonce discrepancy.
   * @param client - The public client for the chain.
   * @param confirmedNonce - The confirmed nonce value.
   */
  private async unclogNonce(confirmedNonce: number, pendingNonce: number) {
    const response = await this.slack.faucet({
      message: `confirmed nonce: ${confirmedNonce}, pending: ${pendingNonce}`,
      title: `Faucet nonce on ${this.node} is out of sync for ${this.getFaucetAddress()}`,
      color: 'warning',
    })
    const missingNonces = await getMissingNonces(
      this.publicClient,
      this.getFaucetAddress()
    )
    const faucetWallet = await this.getFaucetWallet()
    for (const nonce of missingNonces) {
      const baseTx: TransactionSerializableLegacy = {
        to: this.faucetAccount.address,
        chainId: this.chain.id,
        value: 1n,
        nonce,
      }
      const stop = await faucetWallet
        .sendTransaction({
          ...baseTx,
          chain: this.chain,
        })
        .then(async (hash: Hash) => {
          await this.publicClient.waitForTransactionReceipt({ hash })
          return false
        })
        .catch(async (e: Error) => {
          await this.slack.faucet({
            title: `Error bumping nonce for ${this.getFaucetAddress()} on ${this.node} `,
            message: '```' + JSON.stringify(e, stringifyBigInt, 2) + '\n```',
            color: 'danger',
            threadTs: response.ts,
          })
          return true
        })
      if (stop) {
        break
      }
    }
    await Bun.sleep(5_000)
    const { synced, ...nonces } = await this.checkNonces()
    if (!synced) {
      this.slack.faucet({
        message: `Confirmed nonce: ${nonces.confirmed}, pending: ${nonces.pending}`,
        title: `Faucet nonce still out of sync on ${this.node} for ${this.getFaucetAddress()}`,
        color: 'danger',
        threadTs: response.ts,
      })
    } else {
      this.slack.faucet({
        message: `Faucet nonce is now synced on ${this.node} for ${this.getFaucetAddress()}`,
        title: 'Faucet nonce is now synced',
        color: 'good',
        threadTs: response.ts,
      })
    }
  }

  private async checkNonces(): Promise<{
    synced: boolean
    confirmed: number
    pending: number
  }> {
    const nonces = await this.getNonces()
    const synced = nonces.confirmed >= nonces.pending
    return { synced, ...nonces }
  }

  /**
   * Orchestrates the overall check-chain logic:
   *  1. Funds the faucet if needed.
   *  2. Retrieves nonce values.
   *  3. Sends a test transaction if confirmed and pending nonces differ.
   */
  public async runCheck(): Promise<void> {
    await this.fundAddressIfNeeded(this.getFaucetAddress())
    for (const address of this.extraAddresses) {
      await this.fundAddressIfNeeded(address)
    }
    const { synced, ...nonces } = await this.checkNonces()
    if (!synced) {
      await this.unclogNonce(nonces.confirmed, nonces.pending)
    }
  }
}
