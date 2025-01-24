import type { ChildProcess } from 'node:child_process'

import { killProcess, runProcess } from '@test/process/manage'
import {
  NodeProcess,
  NodeProcessOptions,
  SpawnedNode,
  parseVerbosity,
} from '@test/process/node'

const DEFAULT_PORT = 8545

const spawnAnvil = async (
  options: NodeProcessOptions = {}
): Promise<ChildProcess> => {
  const {
    port = DEFAULT_PORT,
    silent = true,
    verbosity,
    waitMs = 2_000,
  } = options
  const silentArg = silent ? ['--silent'] : []
  const args = [
    '--port',
    port.toString(),
    ...silentArg,
    ...parseVerbosity(verbosity),
  ]

  const sfoundryDir = process.env.SFOUNDRY_ROOT
  if (!sfoundryDir) {
    return runProcess('sanvil', {
      args,
      waitMs,
    })
  }

  return runProcess('cargo', {
    args: ['run', '--bin', 'sanvil', '--', ...args],
    cwd: sfoundryDir,
    waitMs,
  })
}

/**
 * Runs `sanvil` in silent mode in the background
 */
const runSanvil = async (
  options: NodeProcessOptions = {}
): Promise<NodeProcess> => {
  const { port = DEFAULT_PORT } = options
  const sanvilProcess = await spawnAnvil(options)
  // Check if process is running by verifying the URL is accessible, etc.
  try {
    return { process: sanvilProcess, url: `http://127.0.0.1:${port}` }
  } catch (e) {
    await killProcess(sanvilProcess)
    throw new Error(`Failed to start seismic-anvil: ${e}`)
  }
}

export const setupAnvilNode = async (
  port = 8545,
  silent = false
): Promise<SpawnedNode> => {
  const anvilProcess = await runSanvil({ port, silent, verbosity: 5 })
  const nodeUrl = anvilProcess.url

  const exitProcess = async () => {
    await killProcess(anvilProcess.process)
  }

  return {
    url: nodeUrl,
    exitProcess,
  }
}
