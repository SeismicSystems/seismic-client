import type {
  Chain,
  Hex,
  LocalAccount,
  PublicClient,
  TransactionSerializableLegacy,
} from 'viem'
import { createPublicClient, formatUnits, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import SlackNotifier from '@sbot/slack'
import {
  type ShieldedWalletClient,
  createShieldedWalletClient,
} from '@sviem/client'

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

export class FaucetManager {
  private chain: Chain
  private faucetAccount: LocalAccount
  private faucetReserveAccount: LocalAccount
  private publicClient: PublicClient
  private slack: SlackNotifier

  constructor(
    chain: Chain,
    faucetPrivateKey: Hex,
    faucetReservePrivateKey: Hex,
    slack: SlackNotifier
  ) {
    this.chain = chain
    this.faucetAccount = privateKeyToAccount(faucetPrivateKey)
    this.faucetReserveAccount = privateKeyToAccount(faucetReservePrivateKey)
    this.publicClient = createPublicClient({ chain, transport: http() })
    this.slack = slack
  }

  private chainName(): string {
    return this.chain.rpcUrls.default.http[0]
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
  private async faucetBalance(): Promise<bigint> {
    return await this.publicClient.getBalance({
      address: this.faucetAccount.address,
    })
  }

  /**
   * Funds the faucet if its balance is below 100 ETH (in wei).
   */
  private async fundFaucetIfNeeded() {
    const originalBalance = await this.faucetBalance()
    if (originalBalance < parseEther('100', 'wei')) {
      console.log(
        `devnet=${this.chain.rpcUrls.default.http[0]}, Faucet balance is too low, sending 100 eth`
      )
      const response = await this.slack.status({
        message: `Faucet balance on ${this.chainName()} is ${formatUnitsRounded(originalBalance)}. Topping up...`,
      })
      const reserveWallet = await this.getReserveWallet()
      const tx = await reserveWallet.sendTransaction({
        to: this.faucetAccount.address,
        value: parseEther('100', 'wei'),
        chain: this.chain,
      })
      const _receipt = await this.publicClient.waitForTransactionReceipt({
        hash: tx,
      })
      const newBalance = await this.faucetBalance()
      this.slack.status({
        message: `Faucet balance on ${this.chainName()} is now ${formatUnitsRounded(newBalance)}`,
        threadTs: response.ts,
      })
    }
  }

  /**
   * Retrieves and returns the confirmed and pending nonce for the faucet address.
   * @param client - The public client for the chain.
   */
  private async getNonces() {
    const confirmedNoncePromise = this.publicClient.getTransactionCount({
      address: this.faucetAccount.address,
    })
    const pendingNoncePromise = this.publicClient.getTransactionCount({
      address: this.faucetAccount.address,
      blockTag: 'pending',
    })
    const [confirmed, pending] = await Promise.all([
      confirmedNoncePromise,
      pendingNoncePromise,
    ])
    return { confirmed, pending }
  }

  /**
   * Sends a test transaction using the faucet wallet if there is a nonce discrepancy.
   * @param client - The public client for the chain.
   * @param confirmedNonce - The confirmed nonce value.
   */
  private async unclogNonce(confirmedNonce: number, pendingNonce: number) {
    const response = await this.slack.status({
      message: `confirmed nonce: ${confirmedNonce}, pending: ${pendingNonce}`,
      title: `Faucet nonce on ${this.chainName()} is out of sync`,
      color: 'warning',
    })
    const faucetWallet = await this.getFaucetWallet()
    const baseTx: TransactionSerializableLegacy = {
      to: this.faucetAccount.address,
      chainId: this.chain.id,
      type: 'legacy',
      gas: 30_000_000n,
      gasPrice: 1_000_000n,
      value: 1n,
      nonce: confirmedNonce,
    }
    const hash = await faucetWallet.sendTransaction({
      ...baseTx,
      chain: this.chain,
    })
    const _receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    Bun.sleep(5_000)
    const { synced, ...nonces } = await this.checkNonces()
    if (!synced) {
      this.slack.urgent({
        message: `Confirmed nonce: ${nonces.confirmed}, pending: ${nonces.pending}`,
        title: 'Faucet nonce still out of sync',
      })
    } else {
      this.slack.status({
        message: `Faucet nonce is now synced on ${this.chainName()}`,
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
    if (nonces.confirmed === nonces.pending) {
      return { synced: true, ...nonces }
    }
    // sleep for 5 seconds to see if they unclog naturally
    await Bun.sleep(5_000)
    const nonces2 = await this.getNonces()
    if (nonces2.confirmed === nonces2.pending) {
      return { synced: true, ...nonces2 }
    }
    return { synced: false, ...nonces2 }
  }

  /**
   * Orchestrates the overall check-chain logic:
   *  1. Funds the faucet if needed.
   *  2. Retrieves nonce values.
   *  3. Sends a test transaction if confirmed and pending nonces differ.
   */
  public async checkChain(): Promise<void> {
    await this.fundFaucetIfNeeded()
    const { synced, ...nonces } = await this.checkNonces()
    if (!synced) {
      await this.unclogNonce(nonces.confirmed, nonces.pending)
    }
  }
}
