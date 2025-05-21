// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title CryptoUtils
/// @notice Utility contract for interacting with crypto precompiles
/// @dev Provides helpers for random nonce generation, encryption, and decryption
contract CryptoUtils {
    ////////////////////////////////////////////////////////////////////////
    // Precompile Addresses
    ////////////////////////////////////////////////////////////////////////

    /// @dev Precompile address for random number generation
    address private constant RNG_PRECOMPILE = address(0x64);

    /// @dev Precompile address for AES encryption
    address private constant AES_ENCRYPT_PRECOMPILE = address(0x66);

    /// @dev Precompile address for AES decryption
    address private constant AES_DECRYPT_PRECOMPILE = address(0x67);

    ////////////////////////////////////////////////////////////////////////
    // Precompile Interaction Functions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Calls the RNG precompile to get a random nonce
    /// @dev Uses precompile at address 0x64 to generate random bytes
    /// @return A 96-bit random nonce
    function _generateRandomNonce() internal view returns (uint96) {
        (bool success, bytes memory output) = RNG_PRECOMPILE.staticcall(abi.encodePacked(uint32(32)));
        require(success, "RNG Precompile call failed");

        bytes32 randomBytes;
        assembly {
            randomBytes := mload(add(output, 32))
        }

        return uint96(uint256(randomBytes));
    }

    function _generateRandomAESKey() internal view returns (suint256) {
        bytes memory personalization = abi.encodePacked("aes-key", block.timestamp); // or "session-aes" or similar
        bytes memory input = abi.encodePacked(uint32(32), personalization);

        (bool success, bytes memory output) = RNG_PRECOMPILE.staticcall(input);
        require(success, "RNG Precompile call failed");
        require(output.length == 32, "Invalid RNG output length");

        bytes32 randomBytes;
        assembly {
            randomBytes := mload(add(output, 32))
        }

        return suint256(randomBytes);
    }

    /// @notice Encrypts the given plaintext with AES key and nonce
    /// @dev Uses AES encryption precompile at address 0x66
    /// @param key The AES key to use for encryption
    /// @param nonce The nonce to use for encryption
    /// @param plaintext The data to encrypt
    /// @return ciphertext The encrypted data
    function _encrypt(suint256 key, uint96 nonce, bytes memory plaintext)
        internal
        view
        returns (bytes memory ciphertext)
    {
        bytes memory input = abi.encodePacked(key, nonce, plaintext);

        (bool success, bytes memory output) = AES_ENCRYPT_PRECOMPILE.staticcall(input);
        require(success, "AES encrypt precompile call failed");
        require(output.length > 0, "Encryption call returned no output");

        return output;
    }

    /// @notice Decrypts the given ciphertext with AES key and nonce
    /// @dev Uses AES decryption precompile at address 0x67
    /// @param key The AES key to use for decryption
    /// @param nonce The nonce used during encryption
    /// @param ciphertext The encrypted data
    /// @return plaintext The decrypted data
    function _decrypt(suint256 key, uint96 nonce, bytes calldata ciphertext)
        internal
        view
        returns (bytes memory plaintext)
    {
        require(ciphertext.length > 0, "Ciphertext cannot be empty");

        bytes memory input = abi.encodePacked(key, nonce, ciphertext);

        (bool success, bytes memory output) = AES_DECRYPT_PRECOMPILE.staticcall(input);
        require(success, "AES decrypt precompile call failed");

        return output;
    }
}
