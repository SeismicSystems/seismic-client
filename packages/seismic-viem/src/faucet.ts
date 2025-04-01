import type { Hex, PublicClient } from 'viem'
import { parseEther } from 'viem/utils'

import { txExplorerUrl } from '@sviem/explorer.ts'

export type CheckFaucetParams = {
  address: Hex
  publicClient: PublicClient
  faucetUrl: string
  minBalanceWei?: bigint | number
  minBalanceEther?: bigint | number
}

export type CheckFaucetResult =
  | { sent: false }
  | { sent: true; hash: Hex; txUrl?: string }

const DEFAULT_MIN_BALANCE_WEI = parseEther('0.5')

const parseMinBalance = (
  minBalanceWei?: bigint | number,
  minBalanceEther?: bigint | number
): bigint => {
  if (minBalanceWei && minBalanceEther) {
    if (BigInt(minBalanceWei) !== parseEther(minBalanceEther.toString())) {
      console.warn(
        'Both minBalanceWei and minBalanceEther provided, using minBalanceWei'
      )
    }
  }

  if (minBalanceWei) {
    return BigInt(minBalanceWei)
  }
  if (minBalanceEther) {
    return parseEther(minBalanceEther.toString())
  }
  return DEFAULT_MIN_BALANCE_WEI
}

export const checkFaucet = async ({
  address,
  publicClient,
  faucetUrl,
  minBalanceWei,
  minBalanceEther,
}: CheckFaucetParams): Promise<CheckFaucetResult> => {
  const balance = await publicClient.getBalance({ address })
  const minBalance = parseMinBalance(minBalanceWei, minBalanceEther)
  if (balance > minBalance) {
    return { sent: false }
  }
  const response = await fetch(`${faucetUrl}/api/claim`, {
    method: 'POST',
    body: JSON.stringify({ address }),
  })
  if (!response.ok) {
    throw new Error(
      `Faucet request failed with status ${response.status}: ${await response.text()}`
    )
  }
  const { msg } = await response.json()

  if (msg.startsWith('Txhash: ')) {
    const hash = msg.slice(8)
    if (hash.startsWith('0x') && hash.length === 66) {
      const txUrl = txExplorerUrl({ chain: publicClient.chain, txHash: hash })
      if (txUrl) {
        console.debug(`Faucet sent eth to ${address}: ${txUrl}`)
      }
      // only return after the tx is confirmed, to prevent double-requesting
      await publicClient.waitForTransactionReceipt({ hash })
      return { sent: true, hash, txUrl: txUrl ?? undefined }
    } else {
      throw new Error(`Invalid hash from faucet claim: ${hash}`)
    }
  }

  throw new Error(`Faucet claim failed: ${msg}`)
}
