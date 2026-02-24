import { localSeismicDevnet, sanvil } from 'seismic-viem'
import type { Chain } from 'viem'

import {
  buildAnvil,
  setupAnvilNode,
} from '@sviem-tests/process/chains/anvil.ts'
import { buildReth, setupRethNode } from '@sviem-tests/process/chains/reth.ts'
import { ServerProcess } from '@sviem-tests/process/manage.ts'

export type NodeProcessOptions = {
  port?: number
  ws?: boolean
  silent?: boolean
  waitMs?: number
  verbosity?: number
}

export type NodeProcess = ServerProcess & { url: string }

export type SpawnedNode = {
  url: string
  exitProcess: () => Promise<void>
}

enum ChainName {
  Anvil = 'anvil',
  Reth = 'reth',
}

const CHAIN_VALUES = Object.values(ChainName).sort()
const CHAIN_OPTIONS = `{${CHAIN_VALUES.join('|')}}`

const nameToChain = (name: ChainName): Chain => {
  switch (name) {
    case ChainName.Anvil:
      return sanvil as Chain
    case ChainName.Reth:
      return localSeismicDevnet as Chain
    default:
      throw new Error(`CHAIN should be one of ${CHAIN_OPTIONS}`)
  }
}

export const envChain = (): Chain => {
  const chainName = process.env.CHAIN as ChainName
  if (!CHAIN_VALUES.includes(chainName)) {
    throw new Error(`CHAIN should be one of ${CHAIN_OPTIONS}`)
  }
  return nameToChain(chainName)
}

export const parseVerbosity = (verbosity: number | undefined): string[] => {
  return verbosity ? [`-${'v'.repeat(Math.min(verbosity, 5))}`] : []
}

export const setupNode = async (
  chain: Chain,
  { port = 8545, ...rest }: NodeProcessOptions = {}
): Promise<SpawnedNode> => {
  switch (chain.id) {
    case sanvil.id:
      return setupAnvilNode({ port, ...rest })
    case localSeismicDevnet.id:
      return setupRethNode({ port, ...rest })
    default:
      throw new Error(`CHAIN should be one of ${CHAIN_OPTIONS}`)
  }
}

export const buildNode = async (chain: Chain) => {
  switch (chain.id) {
    case sanvil.id: {
      const sfoundryDir = process.env.SFOUNDRY_ROOT
      if (!sfoundryDir) {
        throw new Error(
          'SFOUNDRY_ROOT env variable must be set to build sanvil'
        )
      }
      return buildAnvil(sfoundryDir)
    }
    case localSeismicDevnet.id: {
      const srethDir = process.env.SRETH_ROOT
      if (!srethDir) {
        throw new Error('SRETH_ROOT env variable must be set to build reth')
      }
      return buildReth(srethDir)
    }
    default:
      throw new Error(`CHAIN should be one of ${CHAIN_OPTIONS}`)
  }
}
