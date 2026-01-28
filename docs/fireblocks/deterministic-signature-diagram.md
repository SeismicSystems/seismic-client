# Deterministic Signature Approach - Flow Diagram

## Prerequisites

- Fireblocks MPC must use deterministic ECDSA (RFC 6979)
- Same message → Same signature → Same derived key

---

## Encryption Flow (Sending a Transaction)

```
┌──────────────┐                                    
│    Client    │  1. Build deterministic seed message:
│              │     hash("Seismic Key v1" + address + chainId)
└──────────────┘                                    
       │                                            
       │  2. Request signature                      
       ▼                                            
┌──────────────┐                                    
│  Fireblocks  │  Raw Sign(seedMessage)             
│     MPC      │  → keySeedSig (ALWAYS THE SAME)    
└──────────────┘                                    
       │                                            
       │  keySeedSig                                
       ▼                                            
┌─────────────────────────────────────────────────────────────┐
│              Helper Contract (VIEW CALL)                    │
│                                                             │
│  encryptionSk = HKDF(keySeedSig)      ← Derived transiently │
│  sharedSecret = ECDH(encryptionSk, networkPubKey)           │
│  aesKey = HKDF(sharedSecret)          ← Never stored        │
│  ciphertext = AES_ENCRYPT(aesKey, plaintext)                │
│  encryptionPubkey = derivePubkey(encryptionSk)              │
│                                                             │
│  return { ciphertext, encryptionPubkey }                    │
└─────────────────────────────────────────────────────────────┘
       │                                            
       │  { ciphertext, encryptionPubkey }          
       ▼                                            
┌──────────────┐                                    
│    Client    │  Build Seismic transaction         
└──────────────┘                                    
       │                                            
       │  3. Request tx signature                   
       ▼                                            
┌──────────────┐                                    
│  Fireblocks  │  Raw Sign(txHash)                  
│     MPC      │                                    
└──────────────┘                                    
       │                                            
       │  signed transaction                        
       ▼                                            
┌──────────────┐                                    
│   Seismic    │  Standard decryption using         
│   Network    │  encryptionPubkey (unchanged)      
└──────────────┘                                    
```

---

## Decryption Flow (Viewing Past Transactions)

```
┌──────────────┐                                    
│    Client    │  Same seed message as before       
└──────────────┘                                    
       │                                            
       │  Request signature (same message)          
       ▼                                            
┌──────────────┐                                    
│  Fireblocks  │  Raw Sign(seedMessage)             
│     MPC      │  → SAME keySeedSig (deterministic) 
└──────────────┘                                    
       │                                            
       │  keySeedSig (identical to encryption)      
       ▼                                            
┌─────────────────────────────────────────────────────────────┐
│              Helper Contract (VIEW CALL)                    │
│                                                             │
│  encryptionSk = HKDF(keySeedSig)      ← Same as before      │
│  sharedSecret = ECDH(encryptionSk, networkPubKey)           │
│  aesKey = HKDF(sharedSecret)          ← Same key!           │
│  plaintext = AES_DECRYPT(aesKey, ciphertext)                │
│                                                             │
│  return plaintext                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Properties

- No key storage anywhere (client, contract, or HSM)
- Same signature every time → same AES key every time
- Fireblocks controls key existence via signing authority
- All crypto operations use existing precompiles
