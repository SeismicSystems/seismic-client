import { Address, Hex, PublicClient } from 'viem'

export type GetExplorerUrlOptions = {
  item: 'address' | 'tx' | 'block' | 'token'
  id: string
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
  return `${explorerUrl}/${options.item}/${options.id}`
}

export type GetTxExplorerUrlParams = {
  publicClient: PublicClient
  txHash: Hex
}

export const txExplorerUrl = ({
  publicClient,
  txHash,
}: GetTxExplorerUrlParams): string | undefined => {
  const explorerUrl = publicClient.chain?.blockExplorers?.default.url
  if (!explorerUrl) {
    return undefined
  }
  return `${explorerUrl}/tx/${txHash}`
}

export type GetAddressExplorerUrlParams = {
  publicClient: PublicClient
  address: Address
}

export const addressExplorerUrl = ({
  publicClient,
  address,
}: GetAddressExplorerUrlParams): string | undefined => {
  return getExplorerUrl(publicClient, {
    item: 'address',
    id: address,
  })
}

export const tokenExplorerUrl = ({
  publicClient,
  address,
}: GetAddressExplorerUrlParams): string | undefined => {
  return getExplorerUrl(publicClient, {
    item: 'token',
    id: address,
  })
}

export type GetBlockExplorerUrlParams = {
  publicClient: PublicClient
  blockNumber: number
}

export const blockExplorerUrl = ({
  publicClient,
  blockNumber,
}: GetBlockExplorerUrlParams): string | undefined => {
  return getExplorerUrl(publicClient, {
    item: 'block',
    id: blockNumber.toString(),
  })
}
