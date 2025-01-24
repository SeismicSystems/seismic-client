import { Chain, anvil } from 'viem/chains'

import { anvilChain, seismicDevnetChain } from '@sviem/chain'
import { setupAnvilNode } from '@test/process/chains/anvil'
import { setupRethNode } from '@test/process/chains/reth'
import { ServerProcess } from '@test/process/manage'

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
      return anvilChain
    case ChainName.Devnet:
      return seismicDevnetChain
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

export const setupNode = async (chain: Chain): Promise<SpawnedNode> => {
  switch (chain.id) {
    case anvil.id:
      return setupAnvilNode()
    case seismicDevnetChain.id:
      return setupRethNode()
    default:
      throw new Error(`Unable to map Chain ${chain.id} to Backend`)
  }
}
