import { Hex, PublicClient, getContractAddress } from 'viem'

export const getDeployedAddress = async (
  publicClient: PublicClient,
  address: Hex
): Promise<`0x${string}`> => {
  const nonce = BigInt(
    await publicClient.getTransactionCount({
      address: address,
    })
  )

  const deployedAddress = getContractAddress({
    from: address,
    nonce: nonce - BigInt(1),
  })

  return deployedAddress
}
