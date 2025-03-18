import { describe, test } from 'bun:test'

import { envChain, setupNode } from '@sviem-tests/index.ts'
import { testWsConnection } from '@sviem-tests/tests/ws.ts'

describe('ws', () => {
  test('should connect to the ws', async () => {
    const chain = envChain()
    const port = 8549
    const { exitProcess } = await setupNode(chain, { port, ws: true })

    await testWsConnection({
      chain,
      wsUrl: `ws://localhost:${port}`,
    })
    await exitProcess()
  })
})
