import { Chain, webSocket } from 'viem'

import { createShieldedPublicClient } from '@sviem/client.ts'

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
