import { Hex, PublicClient } from 'viem'

export type GetExplorerUrlParams = {
  publicClient: PublicClient
  txHash: Hex
}

export const getExplorerUrl = ({
  publicClient,
  txHash,
}: GetExplorerUrlParams): string | undefined => {
  const explorerUrl = publicClient.chain?.blockExplorers?.default.url
  if (!explorerUrl) {
    return undefined
  }
  return `${explorerUrl}/tx/${txHash}`
}
