// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {P256} from "solady/utils/P256.sol";
import {WebAuthn} from "solady/utils/WebAuthn.sol";

/// @title IShieldedDelegationAccount
/// @notice Interface for ShieldedDelegationAccount functionality
/// @dev Defines the core session management and execution functions
interface IShieldedDelegationAccount {

    /// @notice The type of key
    enum KeyType {
        P256,
        WebAuthnP256,
        Secp256k1
    }

     /// @dev A key that can be used to authorize call.
    struct Key {
        /// @dev Unix timestamp at which the key expires (0 = never).
        uint40 expiry;
        /// @dev Type of key. See the {KeyType} enum.
        KeyType keyType;
        /// @dev Whether the key is authorized.
        bool isAuthorized;
        /// @dev Whether the key is a super admin key.
        /// Super admin keys are allowed to call into super admin functions such as
        /// `authorize` and `revoke` via `execute`.
        bool isSuperAdmin;
        /// @dev Public key in encoded form.
        bytes publicKey;
    }


    /// @notice Session information structure
    struct Session {
        KeyType keyType;
        bytes publicKey;
        uint256 expiry;
        uint256 limitWei;
        uint256 spentWei;
        uint256 nonce;
    }

    /// @notice Emitted when a new session is granted
    /// @param idx The index of the granted session
    /// @param keyType The type of key
    /// @param publicKey The public key
    /// @param expiry The timestamp when the session expires
    /// @param limit The maximum amount of wei that can be spent
    event SessionGranted(uint32 idx, KeyType keyType, bytes publicKey, uint256 expiry, uint256 limit);

    /// @notice Emitted when a session is revoked
    /// @param idx The index of the revoked session
    event SessionRevoked(uint32 idx);

    /// @notice Emitted for debugging purposes
    /// @param message The log message
    event Log(string message);

    /// @notice Creates a new authorized session
    /// @param keyType The type of key
    /// @param publicKey The public key
    /// @param expiry The timestamp when the session expires (0 = unlimited)
    /// @param limitWei The maximum amount of wei that can be spent (0 = unlimited)
    /// @return idx The index of the newly created session
    function grantSession(KeyType keyType, bytes calldata publicKey, uint256 expiry, uint256 limitWei) external returns (uint32 idx);

    /// @notice Revokes an existing session
    /// @param keyType The type of key
    /// @param publicKey The public key
    function revokeSession(KeyType keyType, bytes calldata publicKey) external;

    /// @notice Sets the AES encryption key using the RNG precompile
    function setAESKey() external;

    /// @notice Gas-free helper to encrypt plaintext
    /// @param plaintext The data to encrypt
    /// @return nonce The random nonce used for encryption
    /// @return ciphertext The encrypted data
    function encrypt(bytes calldata plaintext) external view returns (uint96 nonce, bytes memory ciphertext);

    /// @notice Executes transactions after verifying session signature and decrypting payload
    /// @param nonce The nonce used for encryption/decryption
    /// @param ciphertext The encrypted transaction data
    /// @param sig The session signature authorizing the execution
    /// @param idx The index of the session to use
    function execute(uint96 nonce, bytes calldata ciphertext, bytes calldata sig, uint32 idx) external payable;

    /// @notice Gets the current nonce for a session
    /// @param idx The index of the session
    /// @return The current nonce value
    function getSessionNonce(uint32 idx) external view returns (uint256);

    /// @notice Accessor for sessions array
    /// @param idx The index of the session to access
    /// @return keyType The type of key
    /// @return publicKey The public key
    /// @return expiry The timestamp when the session expires
    /// @return limitWei The maximum amount of wei that can be spent
    /// @return spentWei The amount of wei spent from the session
    /// @return nonce The nonce used for the session
    function sessions(uint32 idx)
        external
        view
        returns (KeyType keyType, bytes memory publicKey, uint256 expiry, uint256 limitWei, uint256 spentWei, uint256 nonce);
}
