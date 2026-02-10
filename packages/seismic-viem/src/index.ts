export type {
  SeismicTxExtras,
  SeismicTransactionRequest,
  TransactionSerializableSeismic,
  CreateSeismicDevnetParams,
} from '@sviem/chain.ts'

export type { TxSeismicMetadata } from '@sviem/metadata.ts'
export { buildTxSeismicMetadata } from '@sviem/metadata.ts'
export {
  sanvil,
  seismicTestnet,
  seismicTestnet1,
  seismicTestnet2,
  seismicTestnetGcp1,
  seismicTestnetGcp2,
  localSeismicDevnet,
  createSeismicDevnet,
  createSeismicAzTestnet,
  createSeismicGcpTestnet,
  serializeSeismicTransaction,
  seismicChainFormatters,
  SEISMIC_TX_TYPE,
} from '@sviem/chain.ts'

export { signSeismicTxTypedData } from '@sviem/signSeismicTypedData.ts'

export { getShieldedContract } from '@sviem/contract/contract.ts'
export { signedReadContract } from '@sviem/contract/read.ts'
export { signedCall } from '@sviem/signedCall.ts'
export type { ShieldedWriteContractDebugResult } from '@sviem/contract/write.ts'
export {
  shieldedWriteContract,
  shieldedWriteContractDebug,
  getPlaintextCalldata,
} from '@sviem/contract/write.ts'
export { remapSeismicAbiInputs } from '@sviem/contract/abi.ts'

export {
  createShieldedPublicClient,
  createShieldedWalletClient,
  getEncryption,
} from '@sviem/client.ts'

export type {
  ShieldedPublicClient,
  ShieldedWalletClient,
  GetSeismicClientsParameters,
} from '@sviem/client.ts'

export type { ShieldedContract } from '@sviem/contract/contract.ts'

export type { CheckFaucetParams } from '@sviem/faucet.ts'
export { checkFaucet } from '@sviem/faucet.ts'

export type {
  GetTxExplorerUrlParams,
  GetAddressExplorerUrlParams,
  GetBlockExplorerUrlParams,
  GetTokenExplorerUrlParams,
  GetExplorerUrlOptions,
  GetTxExplorerOptions,
  GetAddressExplorerOptions,
  GetBlockExplorerOptions,
  GetTokenExplorerOptions,
} from '@sviem/explorer.ts'
export {
  getExplorerUrl,
  txExplorerUrl,
  addressExplorerUrl,
  blockExplorerUrl,
  tokenExplorerUrl,
} from '@sviem/explorer.ts'

export { stringifyBigInt } from '@sviem/utils.ts'
export { compressPublicKey } from '@sviem/crypto/secp.ts'
export { encodeSeismicMetadataAsAAD } from '@sviem/crypto/aead.ts'
export {
  AesGcmCrypto,
  generateAesKey,
  deriveAesKey,
  sharedKeyFromPoint,
  sharedSecretPoint,
} from '@sviem/crypto/aes.ts'
export { randomEncryptionNonce } from '@sviem/crypto/nonce.ts'
export type { EncryptionNonce } from '@sviem/crypto/nonce.ts'

export { rng, rngPrecompile } from '@sviem/precompiles/rng.ts'
export { hdfk, hdfkPrecompile } from '@sviem/precompiles/hkdf.ts'
export { ecdh, ecdhPrecompile } from '@sviem/precompiles/ecdh.ts'
export type { EcdhParams } from '@sviem/precompiles/ecdh.ts'
export {
  aesGcmEncrypt,
  aesGcmDecrypt,
  aesGcmEncryptPrecompile,
  aesGcmDecryptPrecompile,
} from '@sviem/precompiles/aes.ts'
export type {
  AesGcmEncryptionParams,
  AesGcmDecryptionParams,
} from '@sviem/precompiles/aes.ts'
export {
  secp256k1Sig,
  secp256k1SigPrecompile,
} from '@sviem/precompiles/secp256k1.ts'
export type { Secp256K1SigParams } from '@sviem/precompiles/secp256k1.ts'

export type { CallClient, Precompile } from '@sviem/precompiles/precompile.ts'
export { DEPOSIT_CONTRACT_ADDRESS } from '@sviem/actions/depositContract.ts'

// SRC20 event watching
export { watchSRC20Events } from '@sviem/actions/src20/watchSRC20Events.ts'
export { watchSRC20EventsWithKey } from '@sviem/actions/src20/watchSRC20EventsWithKey.ts'
export {
  src20PublicActions,
  src20WalletActions,
} from '@sviem/actions/src20/src20Actions.ts'
export type {
  SRC20PublicActions,
  SRC20WalletActions,
} from '@sviem/actions/src20/src20Actions.ts'
export type {
  DecryptedTransferLog,
  DecryptedApprovalLog,
  WatchSRC20EventsParams,
  WatchSRC20EventsWithKeyParams,
} from '@sviem/actions/src20/types.ts'

// Directory contract helpers
export {
  checkRegistration,
  getKeyHash,
  getKey,
  registerKey,
  computeKeyHash,
} from '@sviem/actions/src20/directory.ts'
export { DIRECTORY_ADDRESS, DirectoryAbi } from '@sviem/abis/directory.ts'
