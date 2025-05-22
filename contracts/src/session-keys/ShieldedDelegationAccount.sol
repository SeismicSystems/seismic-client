// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../utils/MultiSend.sol";
import "../utils/precompiles/CryptoUtils.sol";
import "./interfaces/IShieldedDelegationAccount.sol";

/// @title ShieldedDelegationAccount
/// @author ameya-deshmukh
/// @notice Experimental EIP-7702 delegation contract which supports session keys
/// @dev WARNING: THIS CONTRACT IS AN EXPERIMENT AND HAS NOT BEEN AUDITED
contract ShieldedDelegationAccount is IShieldedDelegationAccount, MultiSendCallOnly, CryptoUtils {
    using ECDSA for bytes32;

    ////////////////////////////////////////////////////////////////////////
    // Storage
    ////////////////////////////////////////////////////////////////////////
    struct ShieldedStorage {
        suint256 aesKey;
        bool aesKeyInitialized;
        Session[] sessions;
        mapping(address => uint32) signerToSessionIndex;
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

    modifier onlySelf() {
        require(msg.sender == address(this), "only self");
        _;
    }

    modifier onlyUninitialized() {
        require(!_getStorage().aesKeyInitialized, "AES key already initialized");
        _;
    }

    ////////////////////////////////////////////////////////////////////////
    // Session Management
    ////////////////////////////////////////////////////////////////////////

    function grantSession(address signer, uint256 expiry, uint256 limitWei) external onlySelf returns (uint32 idx) {
        ShieldedStorage storage $ = _getStorage();

        Session memory newSession = Session(signer, expiry, limitWei, 0, 0);

        idx = uint32($.sessions.length);
        $.sessions.push(newSession);
        $.signerToSessionIndex[signer] = idx;

        emit SessionGranted(idx, signer, expiry, limitWei);
    }

    function revokeSession(address signer) external override onlySelf {
        ShieldedStorage storage $ = _getStorage();
        uint32 idx = getSessionIndex(signer);
        uint32 lastIdx = uint32($.sessions.length - 1);

        if (idx != lastIdx) {
            // Swap with last session
            Session memory lastSession = $.sessions[lastIdx];
            $.sessions[idx] = lastSession;
            $.signerToSessionIndex[lastSession.signer] = idx;
        }

        // Remove last session
        $.sessions.pop();
        delete $.signerToSessionIndex[signer];

        emit SessionRevoked(uint32(idx));
    }

    function setAESKey() external override onlySelf onlyUninitialized {
        ShieldedStorage storage $ = _getStorage();
        $.aesKey = _generateRandomAESKey();
        $.aesKeyInitialized = true;
    }

    ////////////////////////////////////////////////////////////////////////
    // Encryption Functions
    ////////////////////////////////////////////////////////////////////////

    function encrypt(bytes calldata plaintext) external view override returns (uint96 nonce, bytes memory ciphertext) {
        nonce = _generateRandomNonce();
        ciphertext = _encrypt(_getStorage().aesKey, nonce, plaintext);
        return (nonce, ciphertext);
    }

    ////////////////////////////////////////////////////////////////////////
    // Execution
    ////////////////////////////////////////////////////////////////////////

    function execute(uint96 nonce, bytes calldata ciphertext, bytes calldata sig, uint32 idx)
        external
        payable
        override
    {
        ShieldedStorage storage $ = _getStorage();
        bytes memory decryptedCiphertext;
        if (msg.sender == address(this)) {
            decryptedCiphertext = _decrypt($.aesKey, nonce, ciphertext);
            multiSend(decryptedCiphertext);
        } else {
            Session storage S = $.sessions[idx];
            require(S.expiry > block.timestamp, "expired");
            require(idx == $.signerToSessionIndex[S.signer], "session key revoked");

            bytes32 dig = _hashTypedDataV4(S.nonce, ciphertext);
            address recoveredSigner = ECDSA.recover(dig, sig);
            require(recoveredSigner == S.signer, "bad signature");

            decryptedCiphertext = _decrypt($.aesKey, nonce, ciphertext);

            uint256 totalValue = 0;
            if (S.limitWei != 0) {
                totalValue = _calculateTotalSpend(decryptedCiphertext);
                require(S.spentWei + totalValue <= S.limitWei, "spend limit exceeded");
                S.spentWei += totalValue;
            }

            S.nonce++;

            multiSend(decryptedCiphertext);
        }
    }

    ////////////////////////////////////////////////////////////////////////
    // EIP-712 Hashing
    ////////////////////////////////////////////////////////////////////////

    function _hashTypedDataV4(uint256 _nonce, bytes memory _cipher) private view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, _nonce, keccak256(_cipher)));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    ////////////////////////////////////////////////////////////////////////
    // Helpers
    ////////////////////////////////////////////////////////////////////////

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

    function getSessionNonce(uint32 idx) external view override returns (uint256) {
        return _getStorage().sessions[idx].nonce;
    }

    // Optional public accessors
    function sessionCount() external view returns (uint256) {
        return _getStorage().sessions.length;
    }

    function getSession(uint32 idx) external view returns (Session memory) {
        return _getStorage().sessions[idx];
    }

    function getSessionIndex(address signer) public view returns (uint32) {
        uint32 idx = _getStorage().signerToSessionIndex[signer];
        require(_getStorage().sessions.length > idx, "signer not found");
        require(_getStorage().sessions[idx].signer == signer, "invalid signer mapping");
        return idx;
    }

    function sessions(uint32 idx)
        external
        view
        returns (address signer, uint256 expiry, uint256 limitWei, uint256 spentWei, uint256 nonce)
    {
        Session memory session = _getStorage().sessions[idx];
        return (session.signer, session.expiry, session.limitWei, session.spentWei, session.nonce);
    }
}
