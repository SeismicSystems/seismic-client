// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../utils/MultiSend.sol";
import "../utils/precompiles/AESPrecompiles.sol";

/// @title ShieldedDelegationAccount
/// @author ameya-deshmukh (https://github.com/ameya-deshmukh)
/// @notice Experimental EIP-7702 delegation contract which supports session keys
/// @dev WARNING: THIS CONTRACT IS AN EXPERIMENT AND HAS NOT BEEN AUDITED
/// @custom:inspired-by https://github.com/ithacaxyz/exp-0001/blob/main/contracts/src/ExperimentDelegation.sol
contract ShieldedDelegationAccount is MultiSendCallOnly, AESPrecompiles {
    using ECDSA for bytes32;

    ////////////////////////////////////////////////////////////////////////
    // EIP-712 Constants
    ////////////////////////////////////////////////////////////////////////

    /// @dev EIP-712 Domain Typehash used for domain separator calculation
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @dev EIP-712 Execute Typehash used for structured data hashing
    bytes32 private constant EXECUTE_TYPEHASH = keccak256("Execute(uint256 nonce,bytes cipher)");

    /// @dev Name of the contract domain for EIP-712
    string private constant DOMAIN_NAME = "ShieldedDelegationAccount";

    /// @dev Version of the contract domain for EIP-712
    string private constant DOMAIN_VERSION = "1";

    ////////////////////////////////////////////////////////////////////////
    // Storage
    ////////////////////////////////////////////////////////////////////////

    /// @dev AES encryption key stored securely on-chain
    suint256 private AES_KEY;

    /// @dev Immutable domain separator for EIP-712
    bytes32 private immutable DOMAIN_SEPARATOR;

    /// @notice Session information structure
    /// @custom:property authorized - Whether the session is currently authorized
    /// @custom:property signer - The secp256k1 address that can sign for this session
    /// @custom:property expiry - Unix timestamp when session expires (0 = unlimited)
    /// @custom:property limitWei - Maximum ether value that can be spent (0 = unlimited)
    /// @custom:property spentWei - Cumulative ether spent by this session
    /// @custom:property nonce - Current nonce for replay protection
    struct Session {
        bool authorized;
        address signer;
        uint256 expiry;
        uint256 limitWei;
        uint256 spentWei;
        uint256 nonce;
    }

    /// @notice List of active and revoked sessions
    /// @dev Index is returned at grant time
    Session[] public sessions;

    ////////////////////////////////////////////////////////////////////////
    // Events
    ////////////////////////////////////////////////////////////////////////

    /// @notice Emitted when a new session is granted
    /// @param idx The index of the granted session
    /// @param signer The address authorized to sign for this session
    /// @param expiry The timestamp when the session expires
    /// @param limit The maximum amount of wei that can be spent
    event SessionGranted(uint32 idx, address signer, uint256 expiry, uint256 limit);

    /// @notice Emitted when a session is revoked
    /// @param idx The index of the revoked session
    event SessionRevoked(uint32 idx);

    /// @notice Emitted for debugging purposes
    /// @param message The log message
    event Log(string message);

    ////////////////////////////////////////////////////////////////////////
    // Constructor
    ////////////////////////////////////////////////////////////////////////

    /// @notice Initializes the contract and the EIP-712 domain separator
    constructor() payable {
        // Initialize EIP-712 domain separator
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

    /// @notice Ensures that only the contract itself can call the function
    modifier onlySelf() {
        require(msg.sender == address(this), "only self");
        _;
    }

    ////////////////////////////////////////////////////////////////////////
    // Session Management
    ////////////////////////////////////////////////////////////////////////

    /// @notice Creates a new authorized session
    /// @param signer The address that will be allowed to sign for this session
    /// @param expiry The timestamp when the session expires (0 = unlimited)
    /// @param limitWei The maximum amount of wei that can be spent (0 = unlimited)
    /// @return idx The index of the newly created session
    function grantSession(address signer, uint256 expiry, uint256 limitWei) external onlySelf returns (uint32 idx) {
        sessions.push(Session(true, signer, expiry, limitWei, 0, 0));
        idx = uint32(sessions.length - 1);
        emit SessionGranted(idx, signer, expiry, limitWei);
    }

    /// @notice Revokes an existing session
    /// @param idx The index of the session to revoke
    function revokeSession(uint32 idx) external onlySelf {
        sessions[idx].authorized = false;
        emit SessionRevoked(idx);
    }

    /// @notice Initializes the contract after deployment
    function initialize() external payable {
        emit Log("Hello, world!");
    }

    /// @notice Sets the AES encryption key
    /// @param _aesKey The new AES key to set
    function setAESKey(suint256 _aesKey) external onlySelf {
        AES_KEY = _aesKey;
    }

    ////////////////////////////////////////////////////////////////////////
    // Encryption Functions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Gas-free helper to encrypt plaintext
    /// @dev Uses precompile at 0x64 for RNG and 0x66 for AES encryption
    /// @param plaintext The data to encrypt
    /// @return nonce The random nonce used for encryption
    /// @return ciphertext The encrypted data
    function encrypt(bytes calldata plaintext) external view returns (uint96 nonce, bytes memory ciphertext) {
        nonce = _generateRandomNonce();
        ciphertext = _encrypt(AES_KEY, nonce, plaintext);
        return (nonce, ciphertext);
    }

    ////////////////////////////////////////////////////////////////////////
    // Execution Functions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Executes transactions after verifying session signature and decrypting payload
    /// @dev Handles spend limits and nonce management
    /// @param nonce The nonce used for encryption/decryption
    /// @param ciphertext The encrypted transaction data
    /// @param sig The session signature authorizing the execution
    /// @param idx The index of the session to use
    function execute(uint96 nonce, bytes calldata ciphertext, bytes calldata sig, uint32 idx) external payable {
        Session storage S = sessions[idx];
        require(S.authorized, "revoked");
        require(S.expiry == 0 || S.expiry > block.timestamp, "expired");

        /* verify session signature */
        bytes32 dig = _hashTypedDataV4(S.nonce, ciphertext);
        address recoveredSigner = ECDSA.recover(dig, sig);
        require(recoveredSigner == S.signer, "bad sig");

        /* decrypt ciphertext with 0x67 */
        bytes memory decryptedCiphertext = _decrypt(AES_KEY, nonce, ciphertext);

        // Calculate total value being spent (only if there's a limit)
        uint256 totalValue = 0;
        if (S.limitWei != 0) {
            totalValue = _calculateTotalSpend(decryptedCiphertext);
            // Check if this transaction would exceed the limit
            require(S.spentWei + totalValue <= S.limitWei, "spend limit exceeded");
        }

        // Execute the multiSend operations
        multiSend(decryptedCiphertext);

        // Update the spent amount if there's a limit
        if (S.limitWei != 0) {
            S.spentWei += totalValue;
        }

        // Increment nonce after successful execution
        S.nonce++;
    }

    ////////////////////////////////////////////////////////////////////////
    // Internal Utility Functions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Calculates the total value being transferred in a multiSend operation
    /// @dev Parses the encoded MultiSend format to extract value transfers
    /// @param data The multiSend encoded operations
    /// @return totalSpend The total amount of ETH being transferred
    function _calculateTotalSpend(bytes memory data) internal pure returns (uint256 totalSpend) {
        uint256 i = 0;
        uint256 len = data.length;
        while (i + 85 <= len) {
            // 85 = 1 (operation) + 20 (to) + 32 (value) + 32 (dataLength)
            // Read operation
            uint8 operation = uint8(data[i]);
            // Only count if operation is CALL (0)
            if (operation == 0) {
                // Read value
                uint256 value;
                assembly {
                    value := mload(add(add(data, 32), add(i, 21))) // i + 1 (skip op) + 20 (to)
                }
                totalSpend += value;
            }
            i += 1 + 20 + 32; // skip operation, to, value
            // Read dataLength
            uint256 dataLength;
            assembly {
                dataLength := mload(add(add(data, 32), i))
            }
            i += 32;
            // Bounds check: ensure we don't overflow
            require(i + dataLength <= len, "Invalid MultiSend data: exceeds length");
            i += dataLength;
        }
        // Final bounds check for malformed trailing data
        require(i == len, "Invalid MultiSend data: unexpected trailing bytes");
        return totalSpend;
    }

    /// @notice Gets the current nonce for a session
    /// @param idx The index of the session
    /// @return The current nonce value
    function getSessionNonce(uint32 idx) external view returns (uint256) {
        return sessions[idx].nonce;
    }

    ////////////////////////////////////////////////////////////////////////
    // EIP-712 Functions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Creates an EIP-712 compatible message hash
    /// @dev Follows the EIP-712 specification for typed data hashing
    /// @param _nonce The current nonce
    /// @param _cipher The cipher data to hash
    /// @return The EIP-712 typed data hash
    function _hashTypedDataV4(uint256 _nonce, bytes memory _cipher) private view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, _nonce, keccak256(_cipher)));

        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
}