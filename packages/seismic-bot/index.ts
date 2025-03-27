import { Chain } from 'viem'
import { Hex } from 'viem'

import { checkAllFaucets } from '@sbot/faucetChecker'
import { seismicDevnet1, seismicDevnet2, seismicDevnet3 } from '@sviem/chain'

const FAUCET_PK_1 = process.env.FAUCET_1_PRIVATE_KEY! as Hex
const FAUCET_PK_2 = process.env.FAUCET_2_PRIVATE_KEY! as Hex
const FAUCET_PK_3 = process.env.FAUCET_3_PRIVATE_KEY! as Hex

export type Key = { pk: Hex; silent?: boolean }
export type FaucetConfig = {
  chain: Chain
  privateKeys: Key[]
}
export type Faucets = Record<string, FaucetConfig>

const faucets: Faucets = {
  'node-1': { chain: seismicDevnet1, privateKeys: [{ pk: FAUCET_PK_1 }] },
  'node-2': {
    chain: seismicDevnet2,
    privateKeys: [
      { pk: FAUCET_PK_1 },
      { pk: FAUCET_PK_2 },
      { pk: FAUCET_PK_3, silent: true },
    ],
  },
  'node-3': { chain: seismicDevnet3, privateKeys: [{ pk: FAUCET_PK_1 }] },
}
checkAllFaucets(faucets)
