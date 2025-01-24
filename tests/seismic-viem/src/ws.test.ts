import { describe, it } from 'bun:test'
import { webSocket } from 'viem'

import { seismicDevnetChain } from '@sviem/chain'
import { createShieldedPublicClient } from '@sviem/client'

describe('ws', () => {
  it('should connect to the ws', async () => {
    const client = await createShieldedPublicClient({
      chain: seismicDevnetChain,
      transport: webSocket('wss://node-1.seismicdev.net/ws'),
    })
    const pk = await client.getTeePublicKey()
    console.log(pk)
  })
})
