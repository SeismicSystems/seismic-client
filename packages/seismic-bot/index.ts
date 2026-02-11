import { Address, Chain } from 'viem'
import { Hex } from 'viem'

import { checkAllFaucets } from '@sbot/faucetChecker'
import { createSeismicDevnet, seismicTestnet } from '@sviem/chain'

const seismicInternalTestnet = createSeismicDevnet({
  nodeHost: 'internal-1.seismictest.net',
})

const FAUCET_PK_1 = process.env.FAUCET_1_PRIVATE_KEY! as Hex
const FAUCET_PK_2 = process.env.FAUCET_2_PRIVATE_KEY! as Hex
const FAUCET_PK_3 = process.env.FAUCET_3_PRIVATE_KEY! as Hex

const PUMP_DEPLOYER_ADDRESS = '0x000a2466401BE2B1090cB17fb51dD601C0642AFc'

const POKER_DEPLOYER_ADDRESS = '0x8f1641811950318E4Dd2B3ab08571125dA51787c'
const POKER_RELAYER_ADDRESS = '0x6D7E58BC9CB7e69117bDB3ccbE495560cDD2434F'

export type Key = { pk: Hex; silent?: boolean }
export type FaucetConfig = {
  chain: Chain
  privateKeys: Key[]
  extraAddresses: Address[]
}
export type Faucets = Record<string, FaucetConfig>

const getTestnetConfig = (chain: Chain): FaucetConfig => ({
  chain,
  privateKeys: [
    { pk: FAUCET_PK_1 },
    { pk: FAUCET_PK_2 },
    { pk: FAUCET_PK_3, silent: true },
  ],
  extraAddresses: [
    PUMP_DEPLOYER_ADDRESS,
    POKER_DEPLOYER_ADDRESS,
    POKER_RELAYER_ADDRESS,
    '0x6D7E58BC9CB7e69117bDB3ccbE495560cDD2434F', // poker relayer 2
    '0xdDBb6f358f290408D76847b4F602f0FD599295fd',
    '0x478669bB3846d79F2fF511CE99eAEE8f85554476',
    '0x8b2568E26Edcb132C8Ba7901be2924100C5155B9',
    '0x88d213e2A577Bae274591fd5de5aC65F17b9881B', // terence
    '0xB83c733772fA07Ed130F58099342416b72f6d9eD', // matt haines 1
    '0xaa1cD3f5BCd5AeeA5F419c6c49a05F9E8Abc104B', // matt haines 2
    '0xabbaeCb4698d59f1185321FA2c32710bC5bad9D3', // matthias
    '0xaf97594412c1b7f2d2dc5abc2f5aeaef4162d4c2', // socialScan
    '0x5B458bF97e86779927576Ea308Ea26FEE0b8a820', // tyler web3 technologies
    '0x959807B8D94B324A74117956731F09E2893aCd72', // dalton
    '0xfA82916B7c548e2D946351AA20dEAA1EEbdFd296', // christian studio desktop
    '0x7A6039B12d1e63369e758195A99a99699c384a5F', // henry
  ],
})

const faucets: Faucets = {
  testnet: getTestnetConfig(seismicTestnet),
  'internal-testnet': getTestnetConfig(seismicInternalTestnet),
}
checkAllFaucets(faucets)
