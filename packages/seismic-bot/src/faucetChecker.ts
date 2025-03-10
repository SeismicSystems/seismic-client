import type { Chain, Hex } from 'viem'

import { FaucetManager } from '@sbot/faucetManager'
import SlackNotifier from '@sbot/slack'

export const checkAllFaucets = async (chains: Chain[]) => {
  const slack = new SlackNotifier(process.env.SLACK_TOKEN!)
  const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY! as Hex
  const faucetReservePrivateKey = process.env.FAUCET_RESERVE_PRIVATE_KEY! as Hex
  for (const chain of chains) {
    const manager = new FaucetManager(
      chain,
      faucetPrivateKey,
      faucetReservePrivateKey,
      slack
    )
    await manager.checkChain()
  }
}
