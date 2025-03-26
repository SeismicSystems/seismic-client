import { sanvil } from 'seismic-viem'
import { privateKeyToAccount } from 'viem/accounts'

import { testSeismicTxTrace } from '@sviem-tests/tests/trace.ts'

// first anvil account
const chain = sanvil
const account = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
)

const tx = await testSeismicTxTrace({
  chain,
  url: chain.rpcUrls.default.http[0],
  account,
})

console.log(tx)
