import { Chain } from 'viem'
import { Hex } from 'viem'

import { checkAllFaucets } from '@sbot/faucetChecker'
import { seismicDevnet1, seismicDevnet2, seismicDevnet3 } from '@sviem/chain'

const FAUCET_PK_1 = process.env.FAUCET_1_PRIVATE_KEY! as Hex
const FAUCET_PK_2 = process.env.FAUCET_2_PRIVATE_KEY! as Hex
const FAUCET_PK_3 = process.env.FAUCET_3_PRIVATE_KEY! as Hex

export type Faucets = Record<string, { chain: Chain; privateKeys: Hex[] }>

const faucets: Faucets = {
  'node-1': { chain: seismicDevnet1, privateKeys: [FAUCET_PK_1] },
  'node-2': {
    chain: seismicDevnet2,
    privateKeys: [FAUCET_PK_1, FAUCET_PK_2, FAUCET_PK_3],
  },
  'node-3': { chain: seismicDevnet3, privateKeys: [FAUCET_PK_1] },
}
checkAllFaucets(faucets)
