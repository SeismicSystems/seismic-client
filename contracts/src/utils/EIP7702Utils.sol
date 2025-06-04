// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../session-keys/interfaces/IShieldedDelegationAccount.sol";
import "solady/utils/SignatureCheckerLib.sol";
import "solady/utils/P256.sol";
import "solady/utils/WebAuthn.sol";

/// @title EIP7702Utils
/// @notice Utility contract for EIP-7702 signature verification and key management for passkeys and session keys
/// @dev Provides helpers for key identification, EIP-712 hashing, and signature verification
contract EIP7702Utils {
    /// @notice Generates a unique identifier for a session key
    /// @param keyType The type of key (P256, WebAuthnP256, or Secp256k1)
    /// @param publicKey The public key bytes
    /// @return The key identifier as bytes32
    function _generateKeyIdentifier(IShieldedDelegationAccount.KeyType keyType, bytes memory publicKey)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(uint8(keyType), keccak256(publicKey)));
    }

    /// @notice Creates an EIP-712 compliant hash for signing
    /// @param nonce The transaction nonce
    /// @param message The message to hash
    /// @param domainSeparator The EIP-712 domain separator
    /// @return The EIP-712 typed data hash
    function _hashTypedDataV4(uint256 nonce, bytes memory message, bytes32 domainSeparator)
        internal
        pure
        returns (bytes32)
    {
        bytes32 executeTypeHash = keccak256("Execute(uint256 nonce,bytes cipher)");
        bytes32 structHash = keccak256(abi.encode(executeTypeHash, nonce, keccak256(message)));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    /// @notice Verifies a signature based on the key type
    /// @param keyType The type of key used for signing
    /// @param publicKey The public key bytes
    /// @param digest The message digest to verify
    /// @param signature The signature bytes
    /// @return isValid True if signature is valid, false otherwise
    function _verifySignature(
        IShieldedDelegationAccount.KeyType keyType,
        bytes memory publicKey,
        bytes32 digest,
        bytes calldata signature
    ) internal view returns (bool isValid) {
        if (keyType == IShieldedDelegationAccount.KeyType.P256) {
            // The try decode functions returns `(0,0)` if the bytes is too short,
            // which will make the signature check fail.
            (bytes32 r, bytes32 s) = P256.tryDecodePointCalldata(signature);
            (bytes32 x, bytes32 y) = P256.tryDecodePoint(publicKey);
            isValid = P256.verifySignature(digest, r, s, x, y);
        } else if (keyType == IShieldedDelegationAccount.KeyType.WebAuthnP256) {
            (bytes32 x, bytes32 y) = P256.tryDecodePoint(publicKey);
            isValid = WebAuthn.verify(
                abi.encode(digest), // Challenge.
                false, // Require user verification optional.
                // This is simply `abi.decode(signature, (WebAuthn.WebAuthnAuth))`.
                WebAuthn.tryDecodeAuth(signature), // Auth.
                x,
                y
            );
        } else if (keyType == IShieldedDelegationAccount.KeyType.Secp256k1) {
            isValid =
                SignatureCheckerLib.isValidSignatureNowCalldata(abi.decode(publicKey, (address)), digest, signature);
        }
    }
}
