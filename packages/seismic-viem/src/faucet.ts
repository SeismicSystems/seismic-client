import type { Hex, PublicClient } from 'viem'
import { parseEther } from 'viem/utils'

export type CheckFaucetParams = {
  address: Hex
  publicClient: PublicClient
  faucetUrl: string
}

/**
 * check the user's balance.
 * if they have < 0.5 ETH, request the faucet to send them testnet ETH
 * @returns a msg with the tx hash of the faucet request, or null if the user has enough ETH
 */
export const checkFaucet = async ({
  address,
  publicClient,
  faucetUrl,
}: CheckFaucetParams): Promise<string | null> => {
  const balance = await publicClient.getBalance({ address })
  if (balance > parseEther('0.5')) {
    return null
  }
  const { msg } = await fetch(faucetUrl, {
    method: 'POST',
    body: JSON.stringify({ address }),
  }).then((res) => res.json())
  // returns string like 'Txhash: 0xca59c...7cf1'
  return msg
}
