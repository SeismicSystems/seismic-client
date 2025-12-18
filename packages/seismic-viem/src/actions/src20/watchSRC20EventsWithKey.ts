import type { Address, Hex } from 'viem'

import { SRC20Abi } from '@sviem/abis/src20.ts'
import { parseEncryptedData } from '@sviem/actions/src20/crypto.ts'
import { computeKeyHash } from '@sviem/actions/src20/directory.ts'
import type { WatchSRC20EventsParams } from '@sviem/actions/src20/types.ts'
import type { ShieldedPublicClient } from '@sviem/client.ts'
import { AesGcmCrypto } from '@sviem/crypto/aes.ts'

/**
 * Watch SRC20 events with a viewing key.
 * Uses a `ShieldedPublicClient` to watch events.
 *
 * @example
 *
 * const unwatch = await client.watchSRC20EventsWithKey({
 *   address: '0x...',
 *   onTransfer: (log) => console.log(`Received ${log.decryptedAmount} from ${log.from}`),
 *   onApproval: (log) => console.log(`Approved ${log.decryptedAmount} to ${log.spender}`),
 * })
 *
 * // Later: stop watching
 * unwatch()
 *  */
export async function watchSRC20EventsWithKey(
  client: ShieldedPublicClient,
  viewingKey: Hex,
  params: WatchSRC20EventsParams
): Promise<() => void> {
  const { address, onTransfer, onApproval, onError } = params

  // Create AES cipher
  const aesCipher = new AesGcmCrypto(viewingKey)

  // Compute encryptKeyHash for filtering events
  const encryptKeyHash = computeKeyHash(viewingKey)

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
