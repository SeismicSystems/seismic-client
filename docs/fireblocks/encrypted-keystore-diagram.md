# Encrypted Key Store Approach - Flow Diagram

## Overview

- Works even if Fireblocks signatures are NOT deterministic
- Stores encrypted keys (useless without Fireblocks authorization)
- Master key derived from Fireblocks signature protects all tx keys

---

## One-Time Setup (Derive Master Key)

```
┌──────────────┐                                    
│    Client    │  Build master seed message:        
│              │  hash("Seismic Master Key" + address + chainId)
└──────────────┘                                    
       │                                            
       │  Request signature                         
       ▼                                            
┌──────────────┐                                    
│  Fireblocks  │  Raw Sign(masterSeedMessage)       
│     MPC      │  → masterSig                       
└──────────────┘                                    
       │                                            
       │  masterSig                                 
       ▼                                            
┌──────────────┐                                    
│    Client    │  masterKey = HKDF(masterSig)       
│              │  (Used to encrypt per-tx keys)     
└──────────────┘                                    
```

---

## Encryption Flow (Sending a Transaction)

```
┌──────────────┐                                    
│    Client    │  Generate random encryptionSk      
│              │  (unique per transaction)          
└──────────────┘                                    
       │                                            
       ▼                                            
┌─────────────────────────────────────────────────────────────┐
│              Helper Contract (VIEW CALL)                    │
│                                                             │
│  sharedSecret = ECDH(encryptionSk, networkPubKey)           │
│  aesKey = HKDF(sharedSecret)                                │
│  ciphertext = AES_ENCRYPT(aesKey, plaintext)                │
│  encryptionPubkey = derivePubkey(encryptionSk)              │
│                                                             │
│  return { ciphertext, encryptionPubkey }                    │
└─────────────────────────────────────────────────────────────┘
       │                                            
       │  { ciphertext, encryptionPubkey }          
       ▼                                            
┌──────────────┐                                    
│    Client    │  1. Encrypt encryptionSk with masterKey:
│              │     encryptedSk = AES(masterKey, encryptionSk)
│              │                                    
│              │  2. Store: { txHash → encryptedSk }
│              │     (Safe: encrypted, useless without Fireblocks)
└──────────────┘                                    
       │                                            
       │  Build & sign transaction                  
       ▼                                            
┌──────────────┐                                    
│  Fireblocks  │  Raw Sign(txHash)                  
│     MPC      │                                    
└──────────────┘                                    
       │                                            
       ▼                                            
   Submit to Seismic Network                        
```

---

## Decryption Flow (Viewing Past Transactions)

```
┌──────────────┐                                    
│    Client    │  Request master signature          
│              │  (same master seed message)        
└──────────────┘                                    
       │                                            
       ▼                                            
┌──────────────┐                                    
│  Fireblocks  │  Raw Sign(masterSeedMessage)       
│     MPC      │  → masterSig                       
└──────────────┘                                    
       │                                            
       │  masterSig (may differ if non-deterministic,
       │  but we stored encryptedSk with original)  
       ▼                                            
┌──────────────┐                                    
│    Client    │  1. Lookup encryptedSk for txHash  
│              │  2. masterKey = HKDF(masterSig)    
│              │  3. encryptionSk = AES_DEC(masterKey, encryptedSk)
│              │  4. Derive aesKey from encryptionSk
│              │  5. Decrypt transaction            
└──────────────┘                                    
```

> **Note:** If masterSig differs each time, you must store the original masterSig OR use deterministic signatures for master key

---

## Storage Model

```
┌─────────────────────────────────────────────────────────────┐
│                     Encrypted Key Store                     │
│                                                             │
│  txHash_1 → AES_ENC(masterKey, encryptionSk_1)              │
│  txHash_2 → AES_ENC(masterKey, encryptionSk_2)              │
│  txHash_3 → AES_ENC(masterKey, encryptionSk_3)              │
│  ...                                                        │
│                                                             │
│  All values are ENCRYPTED                                   │
│  Useless without Fireblocks signing the master message      │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Properties

- Stored keys are encrypted (protected by Fireblocks signature)
- Per-transaction unique keys (better security isolation)
- Works even without deterministic ECDSA
- Fireblocks authorization required to decrypt anything
