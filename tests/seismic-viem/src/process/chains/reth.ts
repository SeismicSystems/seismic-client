import { existsSync } from 'node:fs'

import { killProcess, runProcess } from '@test/process/manage'
import {
  NodeProcess,
  NodeProcessOptions,
  SpawnedNode,
} from '@test/process/node'

type RethProcessOptions = NodeProcessOptions & {
  dev?: boolean
  verbosity?: number
  devBlockMaxTx?: number
  teeMockServer?: boolean
}

const runRethLocally = async (
  options: RethProcessOptions = {}
): Promise<NodeProcess> => {
  const {
    port = 8545,
    silent = true,
    dev = true,
    waitMs = 5_000,
    verbosity = 1,
    devBlockMaxTx = 1,
    teeMockServer = true,
  } = options

  const devArg = dev ? ['--dev'] : []
  const devBlockMaxTxArg = devBlockMaxTx
    ? ['--dev.block-max-transactions', devBlockMaxTx.toString()]
    : []
  const quietArg = silent ? ['--quiet'] : []
  const httpArgs = port ? ['--http', '--http.port', port.toString()] : []
  const verbosityArg = verbosity
    ? [`-${'v'.repeat(Math.min(verbosity, 5))}`]
    : []
  const teeMockServerArg = teeMockServer ? ['--tee.mock-server'] : []

  const dataDirArg = process.env.RETH_DATA_DIR
    ? ['--datadir', process.env.RETH_DATA_DIR]
    : []
  const staticFilesArg = process.env.RETH_STATIC_FILES
    ? ['--datadir.static_files', process.env.RETH_STATIC_FILES]
    : []

  const srethDir = process.env.SRETH_ROOT
  if (!srethDir) {
    throw new Error(
      'Must provide SRETH_ROOT environment variable pointing to local seismic-reth repo'
    )
  }
  if (!existsSync(srethDir)) {
    throw new Error(`Could not find directory at ${srethDir}`)
  }

  const srethProcess = await runProcess('cargo', {
    args: [
      'run',
      '--bin',
      'seismic-reth',
      '--',
      'node',
      ...devArg,
      ...devBlockMaxTxArg,
      ...httpArgs,
      ...teeMockServerArg,
      ...dataDirArg,
      ...staticFilesArg,
      ...verbosityArg,
      ...quietArg,
    ],
    cwd: srethDir,
    waitMs,
  })
  try {
    return { process: srethProcess, url: `http://127.0.0.1:${port}` }
  } catch (e) {
    await killProcess(srethProcess)
    throw new Error(`Failed to start seismic-reth: ${e}`)
  }
}

export const setupRethNode = async (): Promise<SpawnedNode> => {
  const rethProcess = await runRethLocally({ silent: false, verbosity: 0 })
  return {
    url: rethProcess.url,
    exitProcess: async () => {
      await killProcess(rethProcess.process)
    },
  }
}
