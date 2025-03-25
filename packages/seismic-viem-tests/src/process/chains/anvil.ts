import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'

import {
  killProcess,
  runProcess,
  waitForProcessExit,
} from '@sviem-tests/process/manage.ts'
import {
  NodeProcess,
  NodeProcessOptions,
  SpawnedNode,
  parseVerbosity,
} from '@sviem-tests/process/node.ts'

const DEFAULT_PORT = 8545

export const buildAnvil = async (sfoundryDir: string) => {
  if (!sfoundryDir || !existsSync(sfoundryDir)) {
    return
  }

  const buildProcess = await runProcess('cargo', {
    args: ['build', '--bin', 'sanvil'],
    cwd: sfoundryDir,
    stdio: 'inherit',
    waitMs: 0,
  })
  await waitForProcessExit(buildProcess)
}

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
      stdio: 'ignore',
    })
  }

  await buildAnvil(sfoundryDir)
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

export const setupAnvilNode = async ({
  port = 8545,
  ...rest
}: NodeProcessOptions = {}): Promise<SpawnedNode> => {
  const anvilProcess = await runSanvil({ port, ...rest })
  const nodeUrl = anvilProcess.url

  const exitProcess = async () => {
    await killProcess(anvilProcess.process)
  }

  return {
    url: nodeUrl,
    exitProcess,
  }
}
