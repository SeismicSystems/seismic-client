import type { Hex, PublicClient } from 'viem'
import { parseEther } from 'viem/utils'

export type CheckFaucetParams = {
  address: Hex
  publicClient: PublicClient
  faucetUrl: string,
  minBalanceWei?: bigint | number
  minBalanceEther?: bigint | number
}

const DEFAULT_MIN_BALANCE_WEI = parseEther('0.5')

const parseMinBalance = (minBalanceWei?: bigint | number, minBalanceEther?: bigint | number): bigint => {
  if (minBalanceWei && minBalanceEther) {
    if (BigInt(minBalanceWei) !== parseEther(minBalanceEther.toString())) {
      console.warn('Both minBalanceWei and minBalanceEther provided, using minBalanceWei')
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
}: CheckFaucetParams): Promise<string | null> => {
  const balance = await publicClient.getBalance({ address })
  const minBalance = parseMinBalance(minBalanceWei, minBalanceEther)
  if (balance > minBalance) {
    return null
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
  // returns string like 'Txhash: 0xca59c...7cf1'
  console.debug(`Faucet sent eth to ${address}: ${msg}`)
  return msg
}
