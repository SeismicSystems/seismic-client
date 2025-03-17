import { webSocket } from 'viem'

import { seismicDevnet } from '@sviem/chain.ts'
import { createShieldedPublicClient } from '@sviem/client.ts'

export const testWsConnection = async () => {
  const client = await createShieldedPublicClient({
    chain: seismicDevnet,
    transport: webSocket('wss://node-1.seismicdev.net/ws'),
  })
  const pk = await client.getTeePublicKey()
  console.log(pk)
}
