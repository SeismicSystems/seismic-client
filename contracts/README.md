# Seismic Standard Library

This repository contains the Seismic Standard Library, a collection of smart contracts and utilities designed for building secure and efficient applications on the Seismic blockchain.

## Overview

The Seismic Standard Library provides:

- Basic Seismic counter contract
- Session key management for delegated transactions
- AES encryption/decryption utilities via precompiles
- Secure multi-send functionality
- ERC token implementations and extensions

## Key Components

### Seismic Counter

The `SeismicCounter` contract is the Seismic equivalent of the `Counter` (named `TransparentCounter` here) contract, where the counter is an `suint256`.

### Session Keys

The `ShieldedDelegationAccount` contract implements EIP-7702 delegation with session keys, allowing:
- Time-limited authorization for delegates
- Spending limits for delegated transactions
- Encrypted transaction payloads for privacy

### Precompiles

The library includes wrappers for Seismic-specific precompiles:
- `CryptoUtils` for encryption/decryption operations
- Random number generation via precompiles

### Utilities

- `MultiSend` for batched transaction execution
- ECDSA signature verification utilities


