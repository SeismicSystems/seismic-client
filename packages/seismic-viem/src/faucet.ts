import type { Hex, PublicClient } from 'viem'
import { createPublicClient, http } from 'viem'
import { parseEther } from 'viem/utils'

import { seismicDevnet } from '@sviem/chain'

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

const publicClient = createPublicClient({
  chain: seismicDevnet,
  transport: http(),
})
const msg = await checkFaucet({
  address: '0x0000000000000000000000000000000000000000',
  publicClient,
  faucetUrl: 'https://faucet-1.seismicdev.net',
})

console.log(msg)
