import {
  Account,
  Address,
  Chain,
  GetBlockParameters,
  GetTransactionCountParameters,
  Transport,
} from 'viem'
import { parseAccount } from 'viem/accounts'

import type {
  SeismicBlockParams,
  SeismicElements,
  SeismicSecurityParams,
} from '@sviem/chain.ts'
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
  if (nonce_ !== undefined) {
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
  typedDataTx?: boolean
  signedRead?: boolean
} & SeismicSecurityParams

const inferTypedDataTx = (
  typedDataTx: boolean | undefined,
  account: Account
): boolean => {
  if (typedDataTx !== undefined) {
    return typedDataTx
  }
  return account.type === 'json-rpc'
}

export const buildTxSeismicMetadata = async <
  TChain extends Chain | undefined,
  TAccount extends Account,
>(
  client: ShieldedWalletClient<Transport, TChain, TAccount>,
  {
    account: paramsAcct,
    nonce,
    to,
    value = 0n,
    encryptionNonce,
    blocksWindow = 100n,
    recentBlockHash,
    expiresAtBlock,
    typedDataTx,
    signedRead = false,
  }: BuildTxSeismicMetadataParams
): Promise<TxSeismicMetadata> => {
  const account = parseAccount(paramsAcct || client.account)
  if (!account) {
    throw new Error(`Signed reads must have an account`)
  }
  if (blocksWindow <= 0n) {
    throw new Error(`blocksWindow param must be > 0`)
  }

  const resolveBlockParams = async (): Promise<SeismicBlockParams> => {
    if (recentBlockHash && expiresAtBlock) {
      return { recentBlockHash, expiresAtBlock }
    }
    if (recentBlockHash) {
      const recentBlock = await client.getBlock({ blockHash: recentBlockHash })
      return {
        recentBlockHash: recentBlock.hash,
        expiresAtBlock: recentBlock.number + blocksWindow,
      }
    }
    const latestBlock = await client.getBlock({ blockTag: 'latest' })
    if (expiresAtBlock) {
      if (expiresAtBlock <= latestBlock.number) {
        throw new Error(
          `expiresAtBlock param ${expiresAtBlock} is in the past (latest block is #${latestBlock.number})`
        )
      }
      return { recentBlockHash: latestBlock.hash, expiresAtBlock }
    }
    return {
      recentBlockHash: latestBlock.hash,
      expiresAtBlock: latestBlock.number + blocksWindow,
    }
  }

  const useTypedDataTx = inferTypedDataTx(typedDataTx, account)
  const [nonce_, chainId, blockParams] = await Promise.all([
    fillNonce(client, { account, nonce }),
    client.getChainId(),
    resolveBlockParams(),
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
      recentBlockHash: blockParams.recentBlockHash,
      expiresAtBlock: blockParams.expiresAtBlock,
      signedRead,
    },
  }
}
