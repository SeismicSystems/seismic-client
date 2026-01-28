# Encrypted Key Store Approach

## Overview

Each transaction uses a unique encryption key. Keys are stored encrypted, protected by a master key derived from Fireblocks signature. Stored data is useless without Fireblocks.

## Flow

1. One-time: Fireblocks signs master seed → derive `masterKey`
2. Per transaction: generate unique `encryptionSk`, encrypt calldata, store `AES(masterKey, encryptionSk)`
3. Stored keys are encrypted and worthless without Fireblocks authorization

## Decrypting Past Transactions

Request master signature → derive `masterKey` → decrypt stored `encryptionSk` → decrypt transaction

## Requirements

- Secure storage for encrypted keys
- If non-deterministic signatures: must also store original `masterSig`

## Properties

- No plaintext keys stored
- Encrypted keys useless without Fireblocks
- Works with non-deterministic ECDSA
- Per-transaction key isolation

## Trade-off

Requires storing encrypted key material (protected by Fireblocks-derived key)
