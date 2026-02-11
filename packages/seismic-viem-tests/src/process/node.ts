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
  Devnet = 'devnet',
}

const nameToChain = (name: ChainName): Chain => {
  switch (name) {
    case ChainName.Anvil:
      return sanvil as Chain
    case ChainName.Devnet:
      return localSeismicDevnet as Chain
    default:
      throw new Error(`Unable to map ${name} to Chain`)
  }
}

export const envChain = (): Chain => {
  const chainName = process.env.CHAIN as ChainName
  if (!Object.values(ChainName).includes(chainName)) {
    throw new Error(`CHAIN env variable must be either "anvil" or "reth"`)
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
      throw new Error(`Unable to map Chain ${chain.id} to Backend`)
  }
}

export const buildNode = async (chain: Chain) => {
  switch (chain.id) {
    case sanvil.id:
      const sfoundryDir = process.env.SFOUNDRY_ROOT
      if (sfoundryDir) {
        return buildAnvil(sfoundryDir)
      }
    case localSeismicDevnet.id:
      const srethDir = process.env.SRETH_ROOT
      if (srethDir) {
        return buildReth(srethDir)
      }
    default:
      throw new Error(`Unable to map Chain ${chain.id} to Backend`)
  }
}
