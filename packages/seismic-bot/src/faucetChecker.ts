import { Faucets } from 'index.ts'
import type { Hex } from 'viem'

import { FaucetManager } from '@sbot/faucetManager'
import SlackNotifier from '@sbot/slack'

const faucetReservePrivateKey = process.env.FAUCET_RESERVE_PRIVATE_KEY! as Hex

export const checkAllFaucets = async (faucets: Faucets) => {
  console.log(
    `Checking all faucets across ${Object.keys(faucets).length} chains`
  )
  const slack = new SlackNotifier(process.env.SLACK_TOKEN!)
  for (const { chain, privateKeys } of Object.values(faucets)) {
    for (const faucetPrivateKey of privateKeys) {
      const manager = new FaucetManager(
        chain,
        faucetPrivateKey,
        faucetReservePrivateKey,
        slack
      )
      await manager.checkChain()
    }
  }
}
