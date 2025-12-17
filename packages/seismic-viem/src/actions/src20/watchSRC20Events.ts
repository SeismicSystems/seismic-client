import type { Address, Hex } from 'viem'

import { SRC20Abi } from '@sviem/abis/src20.ts'
import { parseEncryptedData } from '@sviem/actions/src20/crypto.ts'
import { computeKeyHash, getKey } from '@sviem/actions/src20/directory.ts'
import type { WatchSRC20EventsParams } from '@sviem/actions/src20/types.ts'
import type { ShieldedWalletClient } from '@sviem/client.ts'
import { AesGcmCrypto } from '@sviem/crypto/aes.ts'

/**
 * Watch SRC20 events for the connected wallet.
 * Automatically fetches the user's AES key from the Directory contract.
 *
 * @example
 *
 * const unwatch = await client.watchSRC20Events({
 *   address: '0x...',
 *   onTransfer: (log) => console.log(`Received ${log.decryptedAmount} from ${log.from}`),
 *   onApproval: (log) => console.log(`Approved ${log.decryptedAmount} to ${log.spender}`),
 * })
 *
 * // Later: stop watching
 * unwatch()
 *  */
export async function watchSRC20Events(
  client: ShieldedWalletClient,
  params: WatchSRC20EventsParams
): Promise<() => void> {
  const { address, onTransfer, onApproval, onError } = params

  // Get user's AES key from Directory via signed read
  const aesKey = await getKey(client)
  if (
    !aesKey ||
    aesKey === '0x' ||
    aesKey ===
      '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    throw new Error('No AES key registered in Directory for this address')
  }

  // Compute encryptKeyHash for filtering events
  const encryptKeyHash = computeKeyHash(aesKey)

  // Create AES cipher
  const aesCipher = new AesGcmCrypto(aesKey)

  // Watch Transfer events
  const unwatchTransfer = client.watchContractEvent({
    address,
    abi: SRC20Abi,
    eventName: 'Transfer',
    args: { encryptKeyHash },
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { ciphertext, nonce } = parseEncryptedData(
            log.args.encryptedAmount as Hex
          )

          const decryptedAmount = await aesCipher.decrypt(ciphertext, nonce)
          onTransfer?.({
            from: log.args.from as Address,
            to: log.args.to as Address,
            encryptKeyHash: log.args.encryptKeyHash as Hex,
            encryptedAmount: log.args.encryptedAmount as Hex,
            decryptedAmount: BigInt(decryptedAmount),
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
          })
        } catch (e) {
          onError?.(e as Error)
        }
      }
    },
  })

  // Watch Approval events
  const unwatchApproval = client.watchContractEvent({
    address,
    abi: SRC20Abi,
    eventName: 'Approval',
    args: { encryptKeyHash },
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const { ciphertext, nonce } = parseEncryptedData(
            log.args.encryptedAmount as Hex
          )
          const decryptedAmount = await aesCipher.decrypt(ciphertext, nonce)
          onApproval?.({
            owner: log.args.owner as Address,
            spender: log.args.spender as Address,
            encryptKeyHash: log.args.encryptKeyHash as Hex,
            encryptedAmount: log.args.encryptedAmount as Hex,
            decryptedAmount: BigInt(decryptedAmount),
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
          })
        } catch (e) {
          onError?.(e as Error)
        }
      }
    },
  })

  // Return combined unwatch function
  return () => {
    unwatchTransfer()
    unwatchApproval()
  }
}
