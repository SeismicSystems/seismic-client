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
  await client.getTeePublicKey()
  const rpcClient = await client.transport.getRpcClient()
  rpcClient.close()
}
