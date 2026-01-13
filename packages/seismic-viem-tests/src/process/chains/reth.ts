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

export type RethProcessOptions = NodeProcessOptions & {
  dev?: boolean
  devBlockTimeSeconds?: number
  enclaveMockServer?: boolean
}

export const buildReth = async (srethDir: string) => {
  if (!srethDir || !existsSync(srethDir)) {
    return
  }
  const buildProcess = await runProcess('cargo', {
    args: ['build', '--bin', 'seismic-reth'],
    cwd: srethDir,
    stdio: 'inherit',
    waitMs: 0,
  })
  await waitForProcessExit(buildProcess)
}

const runRethLocally = async (
  options: RethProcessOptions = {}
): Promise<NodeProcess> => {
  const {
    port = 8545,
    ws = false,
    silent = true,
    dev = true,
    waitMs = 5_000,
    verbosity,
    devBlockTimeSeconds = 2,
    enclaveMockServer = true,
  } = options

  const devArg = dev ? ['--dev'] : []
  const devBlockTimeArg = devBlockTimeSeconds
    ? ['--dev.block-time', `${devBlockTimeSeconds}s`]
    : []
  const quietArg = silent ? ['--quiet'] : []
  const httpArgs = port ? ['--http', '--http.port', port.toString()] : []
  const wsArgs = ws ? ['--ws', '--ws.port', port.toString()] : []
  const verbosityArg = parseVerbosity(verbosity)
  const enclaveMockServerArg = enclaveMockServer
    ? ['--enclave.mock-server']
    : []

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

  await buildReth(srethDir)
  const srethProcess = await runProcess('cargo', {
    args: [
      'run',
      '--bin',
      'seismic-reth',
      '--',
      'node',
      ...devArg,
      ...devBlockTimeArg,
      ...httpArgs,
      ...wsArgs,
      ...enclaveMockServerArg,
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

export const setupRethNode = async ({
  port = 8545,
  ...rest
}: RethProcessOptions = {}): Promise<SpawnedNode> => {
  const rethProcess = await runRethLocally({
    port,
    ...rest,
  })
  return {
    url: rethProcess.url,
    exitProcess: async () => {
      await killProcess(rethProcess.process)
    },
  }
}
