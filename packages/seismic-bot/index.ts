import { Address, Chain } from 'viem'
import { Hex } from 'viem'

import { checkAllFaucets } from '@sbot/faucetChecker'
import { seismicDevnet1, seismicDevnet2, seismicDevnet3 } from '@sviem/chain'

const FAUCET_PK_1 = process.env.FAUCET_1_PRIVATE_KEY! as Hex
const FAUCET_PK_2 = process.env.FAUCET_2_PRIVATE_KEY! as Hex
const FAUCET_PK_3 = process.env.FAUCET_3_PRIVATE_KEY! as Hex

const TRIVIA_ADMIN_ADDRESS = '0x124b6b46BC76115881367fC454c2212c1e7bc2Ac'
const PUMP_DEPLOYER_ADDRESS = '0x000a2466401BE2B1090cB17fb51dD601C0642AFc'
const POKER_DEPLOYER_ADDRESS = '0x75c01Dff58c161B96A334E2d6eCD4dF629439A2e'

export type Key = { pk: Hex; silent?: boolean }
export type FaucetConfig = {
  chain: Chain
  privateKeys: Key[]
  extraAddresses: Address[]
}
export type Faucets = Record<string, FaucetConfig>

const faucets: Faucets = {
  'node-1': {
    chain: seismicDevnet1,
    privateKeys: [{ pk: FAUCET_PK_1 }],
    extraAddresses: [TRIVIA_ADMIN_ADDRESS],
  },
  'node-2': {
    chain: seismicDevnet2,
    privateKeys: [
      { pk: FAUCET_PK_1, silent: true },
      { pk: FAUCET_PK_2 },
      { pk: FAUCET_PK_3, silent: true },
    ],
    extraAddresses: [PUMP_DEPLOYER_ADDRESS, POKER_DEPLOYER_ADDRESS],
  },
  'node-3': {
    chain: seismicDevnet3,
    privateKeys: [{ pk: FAUCET_PK_1 }],
    extraAddresses: [],
  },
}
checkAllFaucets(faucets)
