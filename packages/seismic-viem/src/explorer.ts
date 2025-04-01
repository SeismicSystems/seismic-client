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

export type GetTxExplorerOptions = {
  txHash: Hex
  tab?: TxExplorerTab
}
export type GetTxExplorerUrlParams = { chain?: Chain } & GetTxExplorerOptions

export type GetAddressExplorerOptions = {
  address: Address
  tab?: AddressExplorerTab
}
export type GetAddressExplorerUrlParams = {
  chain?: Chain
} & GetAddressExplorerOptions

export type GetTokenExplorerOptions = {
  address: Address
  tab?: TokenExplorerTab
}
export type GetTokenExplorerUrlParams = {
  chain?: Chain
} & GetTokenExplorerOptions

export type GetBlockExplorerOptions = {
  blockNumber: number
  tab?: BlockExplorerTab
}
export type GetBlockExplorerUrlParams = {
  chain?: Chain
} & GetBlockExplorerOptions

export const getExplorerUrl = (
  chain?: Chain,
  options?: GetExplorerUrlOptions
): string | null => {
  if (!chain) {
    return null
  }
  const explorerUrl = chain.blockExplorers?.default.url
  if (!explorerUrl) {
    return null
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
}: GetAddressExplorerUrlParams): string | null => {
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
}: GetBlockExplorerUrlParams): string | null => {
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
}: GetTxExplorerUrlParams): string | null => {
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
}: GetTokenExplorerUrlParams): string | null => {
  return getExplorerUrl(chain, {
    item: 'token',
    id: address,
    tab,
  })
}
