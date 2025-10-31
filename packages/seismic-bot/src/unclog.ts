import { seismicDevnet2 } from 'seismic-viem'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x?')
console.log(`Account: ${account.address}`)
const client = createWalletClient({
  account,
  chain: seismicDevnet2,
  transport: http(),
})
const hash = await client.sendTransaction({ to: account.address, nonce: 10210 })
