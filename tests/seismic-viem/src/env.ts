import { configDotenv } from 'dotenv'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'url'

export const loadDotenv = () => {
  const dotenvOutput = configDotenv({ path: `${findRepoRoot()}/.env` })
  if (dotenvOutput.error) {
    console.warn('No .env file found in repo root')
  } else {
    console.info(
      `Running ${basename(__filename)} with .env file = ${JSON.stringify(dotenvOutput, null, 2)}`
    )
  }
}

/**
 * Use location of bunfig.toml to find root
 */
const findRepoRoot = () => {
  let current = dirname(fileURLToPath(import.meta.url))
  while (!existsSync(join(current, 'bunfig.toml'))) {
    current = dirname(current)
  }
  return current
}
