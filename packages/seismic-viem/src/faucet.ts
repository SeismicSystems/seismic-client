import type { Hex, PublicClient } from 'viem'
import { parseEther } from 'viem/utils'

export type CheckFaucetParams = {
  address: Hex
  publicClient: PublicClient
  faucetUrl: string
}

export const checkFaucet = async ({
  address,
  publicClient,
  faucetUrl,
}: CheckFaucetParams): Promise<string | null> => {
  const balance = await publicClient.getBalance({ address })
  if (balance > parseEther('0.5')) {
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
  return msg
}
