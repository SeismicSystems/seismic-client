import type { Address, Chain, Hex } from 'viem'

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
  chain: Chain
  txHash: Hex
  tab?: TxExplorerTab
}

export type GetAddressExplorerUrlParams = {
  chain: Chain
  address: Address
  tab?: AddressExplorerTab
}

export type GetTokenExplorerUrlParams = {
  chain: Chain
  address: Address
  tab?: TokenExplorerTab
}

export type GetBlockExplorerUrlParams = {
  chain: Chain
  blockNumber: number
  tab?: BlockExplorerTab
}

export const getExplorerUrl = (
  chain: Chain,
  options?: GetExplorerUrlOptions
): string | undefined => {
  const explorerUrl = chain.blockExplorers?.default.url
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
  chain,
  address,
  tab,
}: GetAddressExplorerUrlParams): string | undefined => {
  return getExplorerUrl(chain, {
    item: 'address',
    id: address,
    tab,
  })
}

export const blockExplorerUrl = ({
  chain,
  blockNumber,
  tab,
}: GetBlockExplorerUrlParams): string | undefined => {
  return getExplorerUrl(chain, {
    item: 'block',
    id: blockNumber.toString(),
    tab,
  })
}

export const txExplorerUrl = ({
  chain,
  txHash,
  tab,
}: GetTxExplorerUrlParams): string | undefined => {
  return getExplorerUrl(chain, {
    item: 'tx',
    id: txHash,
    tab,
  })
}

export const tokenExplorerUrl = ({
  chain,
  address,
  tab,
}: GetTokenExplorerUrlParams): string | undefined => {
  return getExplorerUrl(chain, {
    item: 'token',
    id: address,
    tab,
  })
}
