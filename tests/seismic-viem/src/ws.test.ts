import { afterAll, describe, it } from 'bun:test'

import { envChain, setupNode } from '@sviem-tests/index.ts'
import { testWsConnection } from '@sviem-tests/tests/ws.ts'

const chain = envChain()
const port = 8549
const { exitProcess } = await setupNode(chain, { port })

describe('ws', () => {
  it('should connect to the ws', () =>
    testWsConnection({
      chain,
      wsUrl: `ws://localhost:${port}`,
    }))
})

afterAll(async () => {
  await exitProcess()
})
