import { seismicDevnet2 } from 'seismic-viem'
import { Address, TransactionSerializable, createPublicClient } from 'viem'
import { http } from 'viem'

// Faucet 1
// const ADDRESS = '0xbC3f5d613139d6487A1914521E0F46EF28006bd5'

// Faucet 2
const ADDRESS = '0x97c6BC04c4E3d762890A6dfD4cD181e43169471e'

const publicClient = createPublicClient({
  chain: seismicDevnet2,
  transport: http(),
})

type NonceString = string
type PoolResponse = {
  pending: Record<NonceString, TransactionSerializable>
  queued: Record<NonceString, TransactionSerializable>
}

const pickNonces = (
  txs: Record<NonceString, TransactionSerializable>
): number[] =>
  Object.entries(txs)
    .map(([nonce, tx]) => parseInt(nonce))
    .sort((a, b) => a - b)

const getMissingNonces = async (address: Address): Promise<number[]> => {
  const confirmedNonce = await publicClient.getTransactionCount({
    address,
    blockTag: 'latest',
  })
  const pool: PoolResponse = await publicClient.request({
    method: 'txpool_contentFrom',
    params: [address],
  })
  const queuedNonces = pickNonces(pool.queued)
  const minQueuedNonce = Math.min(...queuedNonces)
  const missingNonces: number[] = []
  for (let i = confirmedNonce; i < minQueuedNonce; i++) {
    missingNonces.push(i)
  }
  return missingNonces
}

console.log(await getMissingNonces(ADDRESS))
