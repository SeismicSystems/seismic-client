import type { ChildProcess, StdioOptions } from 'node:child_process'
import { spawn } from 'node:child_process'
import terminate from 'terminate/promise'

export type ServerProcess = { process: ChildProcess }

export type RunProcessOptions = {
  args?: readonly string[]
  waitMs?: number
  cwd?: string
  stdio?: StdioOptions
  env?: Record<string, string>
}

/**
 * Runs a process
 */
export const runProcess = async (
  command: string,
  options: RunProcessOptions = {}
): Promise<ChildProcess> => {
  const { args = [], waitMs = 100, cwd, stdio = 'inherit', env } = options
  const process = spawn(command, args, {
    cwd,
    stdio,
    env,
  })

  if (waitMs) {
    await new Promise((resolve) => {
      process.on('spawn', () => setTimeout(resolve, waitMs))
    })
  }
  return process
}

/**
 * Kills a process
 */
export const killProcess = async (process: ChildProcess) => {
  const description = process.spawnargs.join(' ')
  if (!process.pid) {
    console.warn(`Cannot kill '${description}': has no pid`)
    return
  }
  try {
    await terminate(process.pid)
    console.info(`Terminated process '${description}'`)
  } catch (error) {
    console.error(
      `Process[${process.pid}] failed to terminate '${description}': ${error}`
    )
  }
}

export const waitForProcessExit = (process: ChildProcess) => {
  return new Promise<void>((resolve) => {
    process.on('exit', () => {
      resolve()
    })
  })
}
