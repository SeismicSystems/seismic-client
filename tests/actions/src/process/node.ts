import { Chain, anvil } from 'viem/chains'

import { seismicChain } from '@actions/chain'
import { setupAnvilNode } from '@test/process/chains/anvil'
import { setupRethNode } from '@test/process/chains/reth'
import { ServerProcess } from '@test/process/manage'

export type NodeProcessOptions = {
  port?: number
  silent?: boolean
  waitMs?: number
}

export type NodeProcess = ServerProcess & { url: string }

export type SpawnedNode = {
  url: string
  exitProcess: (code: 0 | 1) => void
}

enum ChainName {
  Anvil = 'anvil',
  Devnet = 'devnet',
}

const nameToChain = (name: ChainName): Chain => {
  switch (name) {
    case ChainName.Anvil:
      return anvil
    case ChainName.Devnet:
      return seismicChain
    default:
      throw new Error(`Unable to map ${name} to Chain`)
  }
}

export const envChain = (): Chain => {
  const chainName = process.env.CHAIN as ChainName
  if (!Object.values(ChainName).includes(chainName)) {
    throw new Error(`BACKEND env variable must be either "anvil" or "reth"`)
  }
  return nameToChain(chainName)
}

export const setupNode = async (chain: Chain): Promise<SpawnedNode> => {
  switch (chain.id) {
    case anvil.id:
      return setupAnvilNode()
    case seismicChain.id:
      return setupRethNode()
    default:
      throw new Error(`Unable to map Chain ${chain.id} to Backend`)
  }
}
