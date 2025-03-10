import {
  type ShieldedWalletClient,
  createShieldedWalletClient,
} from 'seismic-viem'
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
      this.slack.status(
        `Faucet balance on ${this.chainName()} is ${formatUnitsRounded(originalBalance)}. Topping up...`
      )
      const reserveWallet = await this.getReserveWallet()
      const tx = await reserveWallet.sendTransaction({
        to: this.faucetAccount.address,
        value: parseEther('100', 'wei'),
        chain: this.chain,
      })
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: tx,
      })
      const newBalance = await this.faucetBalance()
      this.slack.status(
        `Faucet balance on ${this.chainName()} is now ${formatUnitsRounded(
          newBalance
        )}`
      )
    }
  }

  /**
   * Retrieves and returns the confirmed and pending nonce for the faucet address.
   * @param client - The public client for the chain.
   */
  private async getNonces() {
    const confirmedNonce = await this.publicClient.getTransactionCount({
      address: this.faucetAccount.address,
    })
    const pendingNonce = await this.publicClient.getTransactionCount({
      address: this.faucetAccount.address,
      blockTag: 'pending',
    })
    return { confirmedNonce, pendingNonce }
  }

  /**
   * Sends a test transaction using the faucet wallet if there is a nonce discrepancy.
   * @param client - The public client for the chain.
   * @param confirmedNonce - The confirmed nonce value.
   */
  private async unclogNonce(confirmedNonce: number, pendingNonce: number) {
    this.slack.urgent(
      `confirmed nonce: ${confirmedNonce}, pending: ${pendingNonce}`,
      `Faucet nonce on ${this.chainName()} is out of sync`
    )
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
    const { synced, ...state } = await this.checkNonces()
    if (!synced) {
      this.slack.urgent(
        `Confirmed nonce: ${state.confirmedNonce}, pending: ${state.pendingNonce}`,
        'Faucet nonce still out of sync'
      )
    }
  }

  /**
   * Orchestrates the overall check-chain logic:
   *  1. Funds the faucet if needed.
   *  2. Retrieves nonce values.
   *  3. Sends a test transaction if confirmed and pending nonces differ.
   */
  private async checkNonces(): Promise<{
    synced: boolean
    confirmedNonce: number
    pendingNonce: number
  }> {
    const { confirmedNonce, pendingNonce } = await this.getNonces()
    if (confirmedNonce === pendingNonce) {
      return { synced: true, confirmedNonce, pendingNonce }
    }

    return { synced: false, confirmedNonce, pendingNonce }
  }

  public async checkChain(): Promise<void> {
    await this.fundFaucetIfNeeded()
    const { synced, confirmedNonce, pendingNonce } = await this.checkNonces()
    if (!synced) {
      await this.unclogNonce(confirmedNonce, pendingNonce)
    }
  }
}
