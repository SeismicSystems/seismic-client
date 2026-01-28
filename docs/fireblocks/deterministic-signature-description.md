# Deterministic Signature Approach

## Overview

Encryption key is derived on-the-fly from a Fireblocks signature. Same message = same signature = same key. No storage required.

## Flow

1. Client builds fixed seed message: `hash("Seismic Key v1" + address + chainId)`
2. Fireblocks signs → `keySeedSig`
3. Helper contract derives key transiently via precompiles: `HKDF(keySeedSig) → encryptionSk → ECDH → AES key`
4. Key exists only during call execution, never stored

## Decrypting Past Transactions

Re-request same signature from Fireblocks → derive same key → decrypt

## Requirements

- Fireblocks must use RFC 6979 (deterministic ECDSA)
- Helper contract using existing precompiles (ECDH, HKDF, AES)

## Properties

- No client-side key storage
- No contract key storage
- No protocol changes
- Fireblocks controls key via signature authority
