import {
  Account,
  Address,
  Chain,
  GetBlockParameters,
  GetTransactionCountParameters,
  Hex,
  Transport,
} from 'viem'
import { parseAccount } from 'viem/accounts'

import type { SeismicElements } from '@sviem/chain.ts'
import { ShieldedWalletClient } from '@sviem/client.ts'
import { randomEncryptionNonce } from '@sviem/crypto/nonce.ts'
import { TYPED_DATA_MESSAGE_VERSION } from '@sviem/signSeismicTypedData.ts'

export type LegacyFields = {
  chainId: number
  nonce: number
  to: Address | null | undefined
  value: bigint
}
export type TxSeismicMetadata = {
  sender: Address
  legacyFields: LegacyFields
  seismicElements: SeismicElements
}

const fillNonce = async <
  TChain extends Chain | undefined,
  TAccount extends Account,
>(
  client: ShieldedWalletClient<Transport, TChain, TAccount>,
  parameters: {
    account: Account | null
    nonce: number | undefined
  } & GetBlockParameters
) => {
  let account = parseAccount(parameters.account || client.account)
  const { nonce: nonce_ } = parameters
  if (nonce_) {
    return nonce_
  }

  const { blockNumber, blockTag = 'latest' } = parameters
  let args: GetTransactionCountParameters = {
    address: account.address,
    blockTag,
  }
  if (blockNumber) {
    args = { address: account.address, blockNumber }
  }
  return client.getTransactionCount(args)
}

type BuildTxSeismicMetadataParams = {
  account: Address | Account | null | undefined
  nonce?: number
  to: Address
  value?: bigint
  encryptionNonce?: Hex
  blocksWindow?: bigint
  signedRead?: boolean
}

export const buildTxSeismicMetadata = async <
  TChain extends Chain | undefined,
  TAccount extends Account,
>({
  client,
  params: {
    account: paramsAcct,
    nonce,
    to,
    value = 0n,
    encryptionNonce,
    blocksWindow = 100n,
    signedRead = false,
  },
}: {
  client: ShieldedWalletClient<Transport, TChain, TAccount>
  params: BuildTxSeismicMetadataParams
}): Promise<TxSeismicMetadata> => {
  const account = parseAccount(paramsAcct || client.account)
  if (!account) {
    throw new Error(`Signed reads must have an account`)
  }

  const useTypedDataTx = account.type === 'json-rpc'
  const [nonce_, chainId, recentBlock] = await Promise.all([
    fillNonce(client, { account, nonce }),
    client.getChainId(),
    client.getBlock({ blockTag: 'latest' }),
  ])

  if (client.chain) {
    if (client.chain.id !== chainId) {
      throw new Error(`Client chain's id does not match eth_chainId response`)
    }
  }

  return {
    sender: account.address,
    legacyFields: {
      chainId,
      nonce: nonce_,
      to,
      value,
    },
    seismicElements: {
      encryptionPubkey: client.getEncryptionPublicKey(),
      encryptionNonce: encryptionNonce ?? randomEncryptionNonce(),
      messageVersion: useTypedDataTx ? TYPED_DATA_MESSAGE_VERSION : 0,
      recentBlockHash: recentBlock.hash,
      expiresAtBlock: recentBlock.number + blocksWindow,
      signedRead,
    },
  }
}
