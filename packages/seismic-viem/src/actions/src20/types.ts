import type { Address, Hex } from 'viem'

export type DecryptedTransferLog = {
  from: Address
  to: Address
  encryptKeyHash: Hex
  encryptedAmount: Hex
  decryptedAmount: bigint
  transactionHash: Hex
  blockNumber: bigint
}

export type DecryptedApprovalLog = {
  owner: Address
  spender: Address
  encryptKeyHash: Hex
  encryptedAmount: Hex
  decryptedAmount: bigint
  transactionHash: Hex
  blockNumber: bigint
}

export type WatchSRC20EventsParams = {
  /** SRC20 contract address */
  address: Address
  /** Callback for Transfer events */
  onTransfer?: (log: DecryptedTransferLog) => void
  /** Callback for Approval events */
  onApproval?: (log: DecryptedApprovalLog) => void
  /** Callback for decryption errors */
  onError?: (error: Error) => void
}

export type WatchSRC20EventsWithKeyParams = WatchSRC20EventsParams & {
  /** The AES viewing key for decryption */
  viewingKey: Hex
}
