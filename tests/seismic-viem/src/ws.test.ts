import { afterAll, beforeAll, describe, test } from 'bun:test'
import { Chain } from 'viem'

import { buildNode, envChain, setupNode } from '@sviem-tests/index.ts'
import { testWsConnection } from '@sviem-tests/tests/ws.ts'

let chain: Chain
let port: number
let exitProcess: () => Promise<void>

beforeAll(async () => {
  chain = envChain()
  port = 8549
  await buildNode(chain)
  const node = await setupNode(chain, { port, ws: true })
  exitProcess = node.exitProcess
})

describe('ws', () => {
  test(
    'should connect to the ws',
    async () => {
      await testWsConnection({
        chain,
        wsUrl: `ws://localhost:${port}`,
      })
    },
    { timeout: 20_000 }
  )
})

afterAll(async () => {
  await exitProcess()
})
