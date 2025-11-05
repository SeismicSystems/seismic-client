import { Address, Chain } from 'viem'
import { Hex } from 'viem'

import { checkAllFaucets } from '@sbot/faucetChecker'
import {
  createSeismicDevnet,
  seismicDevnet1,
  seismicDevnet2,
  seismicDevnet3,
} from '@sviem/chain'

const internalTestnet = createSeismicDevnet({
  nodeHost: 'internal-testnet.seismictest.net',
  explorerUrl: 'explorer.internal-testnet.seismictest.net',
  node: 1,
})

const FAUCET_PK_1 = process.env.FAUCET_1_PRIVATE_KEY! as Hex
const FAUCET_PK_2 = process.env.FAUCET_2_PRIVATE_KEY! as Hex
const FAUCET_PK_3 = process.env.FAUCET_3_PRIVATE_KEY! as Hex

const TRIVIA_ADMIN_ADDRESS = '0x124b6b46BC76115881367fC454c2212c1e7bc2Ac'
const PUMP_DEPLOYER_ADDRESS = '0x000a2466401BE2B1090cB17fb51dD601C0642AFc'

const POKER_DEPLOYER_ADDRESS = '0xbE26ce375D5DF7d6E936579a273d98D0bBA5771C'
const POKER_RELAYER_ADDRESS = '0xccdBFBF91E57C03e87Df1BFf33d5226c93d048aa'

export type Key = { pk: Hex; silent?: boolean }
export type FaucetConfig = {
  chain: Chain
  privateKeys: Key[]
  extraAddresses: Address[]
}
export type Faucets = Record<string, FaucetConfig>

const faucets: Faucets = {
  'internal-testnet': {
    chain: internalTestnet,
    privateKeys: [
      { pk: FAUCET_PK_1 },
      { pk: FAUCET_PK_2 },
      { pk: FAUCET_PK_3, silent: true },
    ],
    extraAddresses: [
      PUMP_DEPLOYER_ADDRESS,
      POKER_DEPLOYER_ADDRESS,
      POKER_RELAYER_ADDRESS,
      '0xdDBb6f358f290408D76847b4F602f0FD599295fd',
      '0x478669bB3846d79F2fF511CE99eAEE8f85554476',
      '0x8b2568E26Edcb132C8Ba7901be2924100C5155B9',
      '0x88d213e2A577Bae274591fd5de5aC65F17b9881B', // terence
      '0xB83c733772fA07Ed130F58099342416b72f6d9eD',  // matt haines
    ],
  },
  'node-1': {
    chain: seismicDevnet1,
    privateKeys: [{ pk: FAUCET_PK_1 }],
    extraAddresses: [
      TRIVIA_ADMIN_ADDRESS,
      POKER_DEPLOYER_ADDRESS,
      POKER_RELAYER_ADDRESS,
    ],
  },
  'node-2': {
    chain: seismicDevnet2,
    privateKeys: [
      { pk: FAUCET_PK_1 },
      { pk: FAUCET_PK_2 },
      { pk: FAUCET_PK_3, silent: true },
    ],
    extraAddresses: [
      PUMP_DEPLOYER_ADDRESS,
      POKER_DEPLOYER_ADDRESS,
      POKER_RELAYER_ADDRESS,
      '0xB83c733772fA07Ed130F58099342416b72f6d9eD',  // matt haines
    ],
  },
  'node-3': {
    chain: seismicDevnet3,
    privateKeys: [{ pk: FAUCET_PK_1 }],
    extraAddresses: [],
  },
}

checkAllFaucets(faucets)
