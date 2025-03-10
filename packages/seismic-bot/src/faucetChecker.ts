import type { Chain, Hex } from 'viem'

import { FaucetManager } from '@sbot/faucetManager'
import SlackNotifier from '@sbot/slack'

export const checkAllFaucets = async (chains: Chain[]) => {
  const slack = new SlackNotifier(process.env.SLACK_TOKEN!)
  const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY! as Hex
  const faucetReservePrivateKey = process.env.FAUCET_RESERVE_PRIVATE_KEY! as Hex
  for (const chain of chains) {
    const manager = new FaucetManager(
      chain,
      faucetPrivateKey,
      faucetReservePrivateKey,
      slack
    )
    await manager.checkChain()
  }
}
/**
const checkChain = async (chain: Chain) => {
  const client = createPublicClient({ chain, transport: http() })
  const reserveWallet = await createShieldedWalletClient({
    chain,
    transport: http(),
    account: privateKeyToAccount(
      process.env.FAUCET_RESERVE_PRIVATE_KEY! as Hex
    ),
  })

  const faucetBalance = await client.getBalance({ address: faucetAddress })
  console.log(
    JSON.stringify(
      { chain: chain.rpcUrls.default.http[0], faucetBalance },
      stringifyBigInt,
      2
    )
  )
  if (faucetBalance < parseEther('100', 'wei')) {
    console.log(
      `devnet=${chain.rpcUrls.default.http[0]}, Faucet balance is too low, sending 100 eth`
    )
    const tx = await reserveWallet.sendTransaction({
      to: faucetAddress,
      value: parseEther('100', 'wei'),
    })
    console.log(`devnet=${chain.rpcUrls.default.http[0]}, Sent tx ${tx}`)
    const receipt = await client.waitForTransactionReceipt({ hash: tx })
    console.log(
      JSON.stringify(
        { chain: chain.rpcUrls.default.http[0], hash: tx, receipt },
        stringifyBigInt,
        2
      )
    )
  }
  const confirmedNonce = await client.getTransactionCount({
    address: faucetAddress,
  })
  const pendingNonce = await client.getTransactionCount({
    address: faucetAddress,
    blockTag: 'pending',
  })

  if (confirmedNonce === pendingNonce) {
    return
  }
  console.log(
    JSON.stringify(
      { chain: chain.rpcUrls.default.http[0], confirmedNonce, pendingNonce },
      null,
      2
    )
  )
  const wallet = await createShieldedWalletClient({
    chain,
    transport: http(),
    account: privateKeyToAccount(process.env.FAUCET_PRIVATE_KEY! as Hex),
  })
  const baseTx: TransactionSerializableLegacy = {
    to: faucetAddress,
    chainId: chain.id,
    type: 'legacy',
    gas: 30_000_000n,
    gasPrice: 1_000_000n,
    value: 1n,
    nonce: confirmedNonce,
  }
  const hash = await wallet.sendTransaction(baseTx)
  console.log(`devnet=${chain.rpcUrls.default.http[0]}, Sent tx ${hash}`)
  const receipt = await client.waitForTransactionReceipt({ hash })
  console.log(
    JSON.stringify(
      { chain: chain.rpcUrls.default.http[0], hash, receipt },
      stringifyBigInt,
      2
    )
  )
}

 * @deprecated Use FaucetManager instead.
 */
