import { Address, Hex, PublicClient } from 'viem'

export type AddressExplorerTab =
  | 'txs'
  | 'token_transfers'
  | 'tokens'
  | 'internal_txns'
  | 'coin_balance_history'
  | 'logs'
  | 'contract'

export type TokenExplorerTab = 'token_transfers' | 'holders' | 'contract'

export type BlockExplorerTab = 'index' | 'txs'

export type TxExplorerTab =
  | 'index'
  | 'token_transfers'
  | 'internal'
  | 'logs'
  | 'state'
  | 'raw_trace'

export type GetTxExplorerUrlOptions = {
  item: 'tx'
  tab?: TxExplorerTab
}

export type GetAddressExplorerUrlOptions = {
  item: 'address'
  tab?: AddressExplorerTab
}

export type GetTokenExplorerUrlOptions = {
  item: 'token'
  tab?: TokenExplorerTab
}

export type GetBlockExplorerUrlOptions = {
  item: 'block'
  tab?: BlockExplorerTab
}

export type GetItemExplorerUrlOptions =
  | GetTxExplorerUrlOptions
  | GetAddressExplorerUrlOptions
  | GetTokenExplorerUrlOptions
  | GetBlockExplorerUrlOptions

export type GetExplorerUrlOptions = { id: string } & GetItemExplorerUrlOptions

export type GetTxExplorerUrlParams = {
  publicClient: PublicClient
  txHash: Hex
  tab?: TxExplorerTab
}

export type GetAddressExplorerUrlParams = {
  publicClient: PublicClient
  address: Address
  tab?: AddressExplorerTab
}

export type GetTokenExplorerUrlParams = {
  publicClient: PublicClient
  address: Address
  tab?: TokenExplorerTab
}

export type GetBlockExplorerUrlParams = {
  publicClient: PublicClient
  blockNumber: number
  tab?: BlockExplorerTab
}

export const getExplorerUrl = (
  publicClient: PublicClient,
  options?: GetExplorerUrlOptions
): string | undefined => {
  const explorerUrl = publicClient.chain?.blockExplorers?.default.url
  if (!explorerUrl) {
    return undefined
  }
  if (!options) {
    return explorerUrl
  }
  const url = `${explorerUrl}/${options.item}/${options.id}`
  if (options.tab) {
    return `${url}?tab=${options.tab}`
  }
  return url
}

export const addressExplorerUrl = ({
  publicClient,
  address,
  tab,
}: GetAddressExplorerUrlParams): string | undefined => {
  return getExplorerUrl(publicClient, {
    item: 'address',
    id: address,
    tab,
  })
}

export const blockExplorerUrl = ({
  publicClient,
  blockNumber,
  tab,
}: GetBlockExplorerUrlParams): string | undefined => {
  return getExplorerUrl(publicClient, {
    item: 'block',
    id: blockNumber.toString(),
    tab,
  })
}

export const txExplorerUrl = ({
  publicClient,
  txHash,
  tab,
}: GetTxExplorerUrlParams): string | undefined => {
  return getExplorerUrl(publicClient, {
    item: 'tx',
    id: txHash,
    tab,
  })
}

export const tokenExplorerUrl = ({
  publicClient,
  address,
  tab,
}: GetTokenExplorerUrlParams): string | undefined => {
  return getExplorerUrl(publicClient, {
    item: 'token',
    id: address,
    tab,
  })
}
