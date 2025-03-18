import { describe, test } from 'bun:test'

import { buildNode, envChain, setupNode } from '@sviem-tests/index.ts'
import { testWsConnection } from '@sviem-tests/tests/ws.ts'

describe('ws', () => {
  test(
    'should connect to the ws',
    async () => {
      const chain = envChain()
      const port = 8549
      await buildNode(chain)
      const { exitProcess } = await setupNode(chain, { port, ws: true })

      await testWsConnection({
        chain,
        wsUrl: `ws://localhost:${port}`,
      })
      await exitProcess()
    },
    { timeout: 20_000 }
  )
})
