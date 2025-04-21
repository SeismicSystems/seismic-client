import { Faucets } from 'index.ts'
import type { Hex } from 'viem'

import { FaucetManager } from '@sbot/faucetManager'
import SlackNotifier from '@sbot/slack'

const faucetReservePrivateKey = process.env.FAUCET_RESERVE_PRIVATE_KEY! as Hex

export const checkAllFaucets = async (faucets: Faucets) => {
  console.log(
    `Checking all faucets across ${Object.keys(faucets).length} chains`
  )
  for (const [node, { chain, privateKeys, extraAddresses }] of Object.entries(
    faucets
  )) {
    for (const { pk, silent } of privateKeys) {
      const slack = new SlackNotifier(process.env.SLACK_TOKEN!, silent)
      const manager = new FaucetManager(
        node,
        chain,
        pk,
        faucetReservePrivateKey,
        slack,
        extraAddresses
      )
      await manager.runCheck()
    }
  }
}
