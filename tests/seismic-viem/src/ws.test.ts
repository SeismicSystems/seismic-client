import { describe, it } from 'bun:test'
import { webSocket } from 'viem'

import { seismicDevnet } from '@sviem/chain.ts'
import { createShieldedPublicClient } from '@sviem/client.ts'

describe('ws', () => {
  it('should connect to the ws', async () => {
    const client = await createShieldedPublicClient({
      chain: seismicDevnet,
      transport: webSocket('wss://node-1.seismicdev.net/ws'),
    })
    const pk = await client.getTeePublicKey()
    console.log(pk)
  })
})
