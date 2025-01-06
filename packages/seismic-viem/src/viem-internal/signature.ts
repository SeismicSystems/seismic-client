import type { Signature, TransactionSerializableGeneric } from 'viem'
import { toHex, trim } from 'viem'

export function toYParitySignatureArray(
  transaction: TransactionSerializableGeneric,
  signature_?: Signature | undefined
) {
  const signature = signature_ ?? transaction
  const { v, yParity } = signature

  if (typeof signature.r === 'undefined') return []
  if (typeof signature.s === 'undefined') return []
  if (typeof v === 'undefined' && typeof yParity === 'undefined') return []

  const r = trim(signature.r)
  const s = trim(signature.s)

  const yParity_ = (() => {
    if (typeof yParity === 'number') return yParity ? toHex(1) : '0x'
    if (v === 0n) return '0x'
    if (v === 1n) return toHex(1)

    return v === 27n ? '0x' : toHex(1)
  })()

  return [yParity_, r === '0x00' ? '0x' : r, s === '0x00' ? '0x' : s]
}
