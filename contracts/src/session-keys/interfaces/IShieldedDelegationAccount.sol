// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title IShieldedDelegationAccount
/// @notice Interface for ShieldedDelegationAccount functionality
/// @dev Defines the core session management and execution functions
interface IShieldedDelegationAccount {
    /// @notice Session information structure
    struct Session {
        bool authorized;
        address signer;
        uint256 expiry;
        uint256 limitWei;
        uint256 spentWei;
        uint256 nonce;
    }

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

    /// @notice Creates a new authorized session
    /// @param signer The address that will be allowed to sign for this session
    /// @param expiry The timestamp when the session expires (0 = unlimited)
    /// @param limitWei The maximum amount of wei that can be spent (0 = unlimited)
    /// @return idx The index of the newly created session
    function grantSession(address signer, uint256 expiry, uint256 limitWei) external returns (uint32 idx);

    /// @notice Revokes an existing session
    /// @param idx The index of the session to revoke
    function revokeSession(uint32 idx) external;

    /// @notice Initializes the contract after deployment
    function initialize() external payable;

    /// @notice Sets the AES encryption key
    /// @param _aesKey The new AES key to set
    function setAESKey(suint256 _aesKey) external;

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

    /// @notice Executes transactions as the owner
    /// @param nonce The nonce used for encryption/decryption
    /// @param ciphertext The encrypted transaction data
    function executeAsOwner(uint96 nonce, bytes calldata ciphertext) external payable;

    /// @notice Gets the current nonce for a session
    /// @param idx The index of the session
    /// @return The current nonce value
    function getSessionNonce(uint32 idx) external view returns (uint256);

    /// @notice Accessor for sessions array
    /// @param idx The index of the session to access
    /// @return authorized Whether the session is authorized
    /// @return signer The address authorized to sign for this session
    /// @return expiry The timestamp when the session expires
    /// @return limitWei The maximum amount of wei that can be spent
    /// @return spentWei The amount of wei spent from the session
    /// @return nonce The nonce used for the session
    function sessions(uint256 idx)
        external
        view
        returns (bool authorized, address signer, uint256 expiry, uint256 limitWei, uint256 spentWei, uint256 nonce);
}
