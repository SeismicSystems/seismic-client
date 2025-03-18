import { expect } from 'bun:test'
import {
  deriveAesKey,
  sharedKeyFromPoint,
  sharedSecretPoint,
} from 'seismic-viem'
import type { Hex } from 'viem'
import { bytesToHex } from 'viem/utils'

export const testAesKeygen = () => {
  const pk =
    '028e76821eb4d77fd30223ca971c49738eb5b5b71eabe93f96b348fdce788ae5a0'
  const sk: Hex =
    '0xa30363336e1bb949185292a2a302de86e447d98f3a43d823c8c234d9e3e5ad77'

  const aesInputs = { networkPublicKey: pk, privateKey: sk }
  const sharedPoint = sharedSecretPoint(aesInputs)
  const spHex = bytesToHex(sharedPoint)
  expect(spHex).toBe(
    '0xae50584c10ef7484c2f28868cce536958960ab86376f1bd7d6c44fcf52e1a18c347bab95860cbd4a9fec067be4217ce48d83964e3d85bdf6b9384a30a44f0653'
  )
  const sharedSecret = sharedKeyFromPoint(sharedPoint)
  expect(sharedSecret).toBe(
    '46a4d6fce8eca748ba8362e726de51a5c62202c887d6bb81fa6f4df1fb360999'
  )
  const aesKey = deriveAesKey(sharedSecret)
  expect(aesKey).toBe(
    '0xbf0dd6556618d1bf8d1602bf80be3a0f7cc729973829bb9acb75bd77770d5b90'
  )
}
