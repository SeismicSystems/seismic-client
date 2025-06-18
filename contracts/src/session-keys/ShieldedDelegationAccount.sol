// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "solady/utils/SignatureCheckerLib.sol";
import "../utils/MultiSend.sol";
import "../utils/precompiles/CryptoUtils.sol";
import "../utils/EIP7702Utils.sol";
import "./interfaces/IShieldedDelegationAccount.sol";

/// @title ShieldedDelegationAccount
/// @author ameya-deshmukh
/// @notice Experimental EIP-7702 delegation contract which supports session keys
/// @dev WARNING: THIS CONTRACT IS AN EXPERIMENT AND HAS NOT BEEN AUDITED
/// @dev Credits: Inspired by https://github.com/ithacaxyz/exp-0001 by jxom (https://github.com/jxom)
/// @dev Credits: Inspired by https://github.com/ithacaxyz/account by Tanishk Goyal (https://github.com/legion2002) and vectorized (https://github.com/vectorized)
contract ShieldedDelegationAccount is IShieldedDelegationAccount, MultiSendCallOnly, CryptoUtils, EIP7702Utils {
    using ECDSA for bytes32;

    ////////////////////////////////////////////////////////////////////////
    // Storage
    ////////////////////////////////////////////////////////////////////////
    struct ShieldedStorage {
        suint256 aesKey;
        bool aesKeyInitialized;
        Key[] keys;
        mapping(bytes32 => uint32) keyToSessionIndex; // add 1 to the index to distinguish from 0 unset
    }

    function _getStorage() internal pure returns (ShieldedStorage storage $) {
        uint256 s = uint72(bytes9(keccak256("SHIELDED_DELEGATION_STORAGE")));
        assembly ("memory-safe") {
            $.slot := s
        }
    }

    ////////////////////////////////////////////////////////////////////////
    // EIP-712 Constants
    ////////////////////////////////////////////////////////////////////////

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 private constant EXECUTE_TYPEHASH = keccak256("Execute(uint256 nonce,bytes cipher)");
    string private constant DOMAIN_NAME = "ShieldedDelegationAccount";
    string private constant DOMAIN_VERSION = "1";

    ////////////////////////////////////////////////////////////////////////
    // Immutable
    ////////////////////////////////////////////////////////////////////////

    bytes32 private immutable DOMAIN_SEPARATOR;

    ////////////////////////////////////////////////////////////////////////
    // Constructor
    ////////////////////////////////////////////////////////////////////////

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    ////////////////////////////////////////////////////////////////////////
    // Access Control
    ////////////////////////////////////////////////////////////////////////

    /// @notice Modifier to ensure the caller is the contract itself
    modifier onlySelf() {
        require(msg.sender == address(this), "only self");
        _;
    }

    /// @notice Modifier to ensure the AES key is not initialized
    modifier onlyUninitialized() {
        require(!_getStorage().aesKeyInitialized, "AES key already initialized");
        _;
    }

    ////////////////////////////////////////////////////////////////////////
    // Key Management
    ////////////////////////////////////////////////////////////////////////

    /// @notice Authorizes a key
    /// @param keyType The type of key
    /// @param publicKey The public key of the key
    /// @param expiry The expiry of the key
    /// @param limitWei The spend limit of the key (in wei)
    /// @return idx The index of the key
    function authorizeKey(KeyType keyType, bytes calldata publicKey, uint40 expiry, uint256 limitWei)
        external
        override
        onlySelf
        returns (uint32 idx)
    {
        ShieldedStorage storage $ = _getStorage();

        Key memory newKey = Key({
            keyType: keyType,
            publicKey: publicKey,
            expiry: expiry,
            spendLimit: limitWei,
            spentWei: 0,
            nonce: 0,
            isAuthorized: true
        });

        idx = uint32($.keys.length);
        $.keys.push(newKey);
        bytes32 keyHash = _generateKeyIdentifier(keyType, publicKey);
        $.keyToSessionIndex[keyHash] = idx + 1;

        emit KeyAuthorized(keyHash, newKey);
        return idx + 1;
    }

    /// @notice Revokes a key
    /// @param keyType The type of key
    /// @param publicKey The public key of the key
    function revokeKey(KeyType keyType, bytes calldata publicKey) external override onlySelf {
        ShieldedStorage storage $ = _getStorage();
        bytes32 keyHash = _generateKeyIdentifier(keyType, publicKey);
        uint32 idx = $.keyToSessionIndex[keyHash];

        require(idx != 0, "key not found");

        uint32 lastIdx = uint32($.keys.length);

        if (idx != lastIdx) {
            Key memory lastKey = $.keys[lastIdx - 1];
            $.keys[idx - 1] = lastKey;
            $.keyToSessionIndex[_generateKeyIdentifier(lastKey.keyType, lastKey.publicKey)] = idx;
        }

        $.keys.pop();
        delete $.keyToSessionIndex[keyHash];

        emit KeyRevoked(keyHash);
    }

    /// @notice Sets the AES key
    function setAESKey() external override onlySelf onlyUninitialized {
        ShieldedStorage storage $ = _getStorage();
        $.aesKey = _generateRandomAESKey();
        $.aesKeyInitialized = true;
    }

    ////////////////////////////////////////////////////////////////////////
    // Encryption Functions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Encrypts a call
    /// @param plaintext The plaintext of the call
    /// @return nonce The nonce of the call
    /// @return ciphertext The ciphertext of the call
    function encrypt(bytes calldata plaintext) external view override returns (uint96 nonce, bytes memory ciphertext) {
        nonce = _generateRandomNonce();
        // Regenerate nonce if it's 0 (extremely unlikely but ensures we can use 0 as sentinel)
        while (nonce == 0) nonce = _generateRandomNonce();
        ciphertext = _encrypt(_getStorage().aesKey, nonce, plaintext);
        return (nonce, ciphertext);
    }

    ////////////////////////////////////////////////////////////////////////
    // Execution
    ////////////////////////////////////////////////////////////////////////

    /// @notice Executes a call via key
    /// @param nonce The nonce of the call
    /// @param calls The encoded calls to execute (plaintext if nonce is 0, ciphertext otherwise)
    /// @param sig The signature of the call
    /// @param idx The index of the key to use
    function execute(uint96 nonce, bytes calldata calls, bytes calldata sig, uint32 idx) external payable override {
        ShieldedStorage storage $ = _getStorage();
        bytes memory executionData;

        if (msg.sender == address(this)) {
            if (nonce == 0) {
                executionData = calls;
            } else {
                executionData = _decrypt($.aesKey, nonce, calls);
            }
            multiSend(executionData);
        } else {
            Key storage S = $.keys[idx - 1];
            require(S.expiry > block.timestamp, "key expired");
            require(idx == $.keyToSessionIndex[_generateKeyIdentifier(S.keyType, S.publicKey)], "key revoked");

            bytes32 dig = _hashTypedDataV4(S.nonce, calls, DOMAIN_SEPARATOR);
            bool isValid = _verifySignature(S.keyType, S.publicKey, dig, sig);
            require(isValid, "invalid signature");

            if (nonce == 0) {
                executionData = calls;
            } else {
                executionData = _decrypt($.aesKey, nonce, calls);
            }

            uint256 totalValue = 0;
            if (S.spendLimit != 0) {
                totalValue = _calculateTotalSpend(executionData);
                require(S.spentWei + totalValue <= S.spendLimit, "spend limit exceeded");
                S.spentWei += totalValue;
            }

            S.nonce++;
            multiSend(executionData);
        }
    }

    ////////////////////////////////////////////////////////////////////////
    // Helpers
    ////////////////////////////////////////////////////////////////////////

    /// @notice Calculates the total spend of a transaction
    /// @param data The data of the transaction
    /// @return totalSpend The total spend of the transaction
    function _calculateTotalSpend(bytes memory data) internal pure returns (uint256 totalSpend) {
        uint256 i = 0;
        uint256 len = data.length;
        while (i + 85 <= len) {
            uint8 operation = uint8(data[i]);
            if (operation == 0) {
                uint256 value;
                assembly {
                    value := mload(add(add(data, 32), add(i, 21)))
                }
                totalSpend += value;
            }
            i += 1 + 20 + 32;
            uint256 dataLength;
            assembly {
                dataLength := mload(add(add(data, 32), i))
            }
            i += 32;
            require(i + dataLength <= len, "Invalid MultiSend data: exceeds length");
            i += dataLength;
        }
        require(i == len, "Invalid MultiSend data: unexpected trailing bytes");
        return totalSpend;
    }

    /// @notice Verifies a signature and consumes the nonce
    /// @dev This function is used to verify a signature and consume the nonce of a key
    /// @dev This is primarily for external contracts to verify signatures and consume nonces to avoid replay attacks, for use cases like signed reads using passkeys/session keys.
    /// @param idx The index of the key
    /// @param message The message to verify
    /// @param sig The signature to verify
    /// @return valid True if the signature is valid
    function verifyAndConsumeNonce(uint32 idx, bytes calldata message, bytes calldata sig) external returns (bool) {
        Key storage key = _getStorage().keys[idx - 1];
        require(key.expiry > block.timestamp, "key expired");
        require(idx == getKeyIndex(key.keyType, key.publicKey), "key revoked");
        bytes32 domainSeparator = getDomainSeparator();
        bytes32 digest = _hashTypedDataV4(key.nonce, message, domainSeparator);
        bool valid = _verifySignature(key.keyType, key.publicKey, digest, sig);
        require(valid, "invalid sig");
        key.nonce++;
        return true;
    }

    /// @notice Returns the nonce of a key
    /// @param idx The index of the key
    /// @return The nonce of the key
    function getKeyNonce(uint32 idx) external view override returns (uint256) {
        return _getStorage().keys[idx - 1].nonce;
    }

    /// @notice Returns the number of keys
    /// @return The number of keys
    function keyCount() external view returns (uint256) {
        return _getStorage().keys.length;
    }

    /// @notice Returns a key
    /// @param idx The index of the key
    /// @return The key
    function getKey(uint32 idx) external view returns (Key memory) {
        return _getStorage().keys[idx - 1];
    }

    /// @notice Returns the index of a key
    /// @param keyType The type of key
    /// @param publicKey The public key
    /// @return The index of the key
    function getKeyIndex(KeyType keyType, bytes memory publicKey) public view returns (uint32) {
        ShieldedStorage storage $ = _getStorage();
        bytes32 keyHash = _generateKeyIdentifier(keyType, publicKey);
        uint32 idx = $.keyToSessionIndex[keyHash];
        require(idx != 0, "key not found");
        require(
            $.keys[idx - 1].keyType == keyType && keccak256($.keys[idx - 1].publicKey) == keccak256(publicKey),
            "invalid key mapping"
        );
        return idx;
    }

    /// @notice Returns the EIP-712 domain separator
    /// @return The domain separator used for EIP-712 typed data signing
    function getDomainSeparator() public view returns (bytes32) {
        return DOMAIN_SEPARATOR;
    }

    receive() external payable {}
}
