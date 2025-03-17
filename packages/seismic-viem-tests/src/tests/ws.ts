import { createShieldedPublicClient, seismicDevnet } from 'seismic-viem'
import { webSocket } from 'viem'

export const testWsConnection = async () => {
  const client = await createShieldedPublicClient({
    chain: seismicDevnet,
    transport: webSocket('wss://node-1.seismicdev.net/ws'),
  })
  const pk = await client.getTeePublicKey()
  console.log(pk)
}
