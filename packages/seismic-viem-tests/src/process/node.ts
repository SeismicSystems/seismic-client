import type { Chain } from 'viem'

import { setupAnvilNode } from '@sviem-tests/process/chains/anvil.ts'
import { setupRethNode } from '@sviem-tests/process/chains/reth.ts'
import { ServerProcess } from '@sviem-tests/process/manage.ts'
import { sanvil, seismicDevnet } from '@sviem/chain.ts'

export type NodeProcessOptions = {
  port?: number
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
      return seismicDevnet as Chain
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
    case seismicDevnet.id:
      return setupRethNode({ port, ...rest })
    default:
      throw new Error(`Unable to map Chain ${chain.id} to Backend`)
  }
}
