import { Chain } from 'viem'
import { Hex } from 'viem'

import { checkAllFaucets } from '@sbot/faucetChecker'
import { seismicDevnet1, seismicDevnet2, seismicDevnet3 } from '@sviem/chain'

const FAUCET_PK_1 = process.env.FAUCET_1_PRIVATE_KEY! as Hex
const FAUCET_PK_2 = process.env.FAUCET_2_PRIVATE_KEY! as Hex

export type Faucets = Record<number, { chain: Chain; privateKeys: Hex[] }>

const faucets: Faucets = {
  [seismicDevnet1.id]: { chain: seismicDevnet1, privateKeys: [FAUCET_PK_1] },
  [seismicDevnet2.id]: {
    chain: seismicDevnet2,
    privateKeys: [FAUCET_PK_1, FAUCET_PK_2],
  },
  [seismicDevnet3.id]: { chain: seismicDevnet3, privateKeys: [FAUCET_PK_1] },
}
checkAllFaucets(faucets)
