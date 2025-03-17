import { createShieldedPublicClient } from 'seismic-viem'
import { Chain, webSocket } from 'viem'

export const testWsConnection = async ({
  chain,
  wsUrl,
}: {
  chain: Chain
  wsUrl: string
}) => {
  const client = await createShieldedPublicClient({
    chain,
    transport: webSocket(wsUrl),
  })
  const pk = await client.getTeePublicKey()
  console.log(pk)
}
