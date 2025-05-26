// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/session-keys/ShieldedDelegationAccount.sol";
import "../src/utils/TestToken.sol";
import {Base64} from "solady/utils/Base64.sol";

/// @title ShieldedDelegationAccountTest
/// @notice Test suite for ShieldedDelegationAccount contract
/// @dev Uses Foundry's Test contract for assertions and utilities
contract ShieldedDelegationAccountTest is Test, ShieldedDelegationAccount {
    ////////////////////////////////////////////////////////////////////////
    // Test Contracts
    ////////////////////////////////////////////////////////////////////////

    /// @dev The main contract under test
    ShieldedDelegationAccount acc;

    /// @dev Test token for transfer operations
    TestToken tok;

    ////////////////////////////////////////////////////////////////////////
    // Test Parameters
    ////////////////////////////////////////////////////////////////////////

    /// @dev Session key's private key for signing (fixed for deterministic tests)
    uint256 constant SK = 0xBEEF;

    /// @dev Admin private key for signing
    uint256 constant ADMIN_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    /// @dev Admin's address
    address payable ADMIN_ADDRESS = payable(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);

    /// @dev Alice private key for signing
    uint256 constant ALICE_PK = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;

    /// @dev Alice's address
    address payable ALICE_ADDRESS = payable(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);

    /// @dev Relay private key for signing
    uint256 constant RELAY_PK = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

    /// @dev Relay's address
    address payable RELAY_ADDRESS = payable(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);

    /// @dev Bob's private key for signing
    uint256 constant BOB_PK = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;

    /// @dev Bob's address
    address payable BOB_ADDRESS = payable(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65);

    /// @dev Address derived from session key
    address SKaddr;

    /// @dev Test addresses for operations
    address constant alice = address(0xA11CE);
    address constant bob = address(0xB0B);
    address constant relayer = address(0xAA);

    ////////////////////////////////////////////////////////////////////////

    /// @dev EIP-712 Domain Typehash used for domain separator calculation
    bytes32 constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @dev EIP-712 Execute Typehash used for structured data hashing
    bytes32 constant EXECUTE_TYPEHASH = keccak256("Execute(uint256 nonce,bytes cipher)");

    /// @dev Name of the contract domain for EIP-712
    string constant DOMAIN_NAME = "ShieldedDelegationAccount";

    /// @dev Version of the contract domain for EIP-712
    string constant DOMAIN_VERSION = "1";

    ////////////////////////////////////////////////////////////////////////
    // Setup
    ////////////////////////////////////////////////////////////////////////

    /// @notice Setup function that runs before each test
    /// @dev Initializes contracts and test environment
    function setUp() public {
        // Derive the EOA for our test session key
        SKaddr = vm.addr(SK);

        // Fund the relayer with some ETH for gas
        vm.deal(relayer, 1 ether);

        // Deploy the shielded delegation account contract
        vm.startPrank(ADMIN_ADDRESS);
        acc = new ShieldedDelegationAccount();

        // Deploy the test token and mint tokens to Alice and the account
        tok = new TestToken();
        tok.mint(ALICE_ADDRESS, suint256(100 * 10 ** 18));
        vm.stopPrank();

        // Sign the authorization for the account and
        // set the code to Alice's address
        _signAndAttachDelegation(address(acc));

        // Verify that Alice's account now behaves as a smart contract.
        bytes memory code = address(ALICE_ADDRESS).code;
        require(code.length > 0, "no code written to Alice");
    }

    ////////////////////////////////////////////////////////////////////////
    // Utility Functions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Creates a domain separator matching the one used in the contract
    /// @dev Used for EIP-712 signature generation
    /// @return domainSeparator The computed domain separator
    function _getDomainSeparator() internal view returns (bytes32 domainSeparator) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                address(acc)
            )
        );
    }

    /// @notice Creates a MultiSend-compatible call to transfer ETH
    /// @param recipient Address to receive ETH
    /// @param amount Amount of ETH to transfer
    /// @return calls Encoded call data for MultiSend
    function _createEthTransferCall(address recipient, uint256 amount) internal pure returns (bytes memory calls) {
        return abi.encodePacked(
            uint8(0), // operation (0 = call)
            recipient, // recipient address
            amount, // ETH amount
            uint256(0), // data length
            bytes("") // empty data
        );
    }

    /// @notice Creates a MultiSend-compatible call to transfer tokens
    /// @param recipient Address to receive tokens
    /// @param amount Amount of tokens to transfer
    /// @return calls Encoded call data for MultiSend
    function _createTokenTransferCall(address recipient, uint256 amount) internal view returns (bytes memory calls) {
        // Create the transfer function call data
        bytes memory transferData =
            abi.encodeWithSelector(SRC20.transfer.selector, saddress(recipient), suint256(amount));

        // Format it for MultiSend
        return abi.encodePacked(
            uint8(0), // operation (0 = call)
            address(tok), // to: token contract address
            uint256(0), // value: 0 ETH (no ETH sent with token transfer)
            uint256(transferData.length), // data length
            transferData // the actual calldata
        );
    }

    /// @notice Creates and signs a digest for the execute function
    /// @param keyIndex Index of the key to use
    /// @param cipher Encrypted data to be executed
    /// @return signature The signature bytes
    function _signExecuteDigestWithKey(address account, uint32 keyIndex, bytes memory cipher, uint256 privateKey)
        internal
        view
        returns (bytes memory signature)
    {
        uint256 keyNonce = ShieldedDelegationAccount(account).getKeyNonce(keyIndex);
        Key memory key = ShieldedDelegationAccount(account).keys(keyIndex);
        bytes32 domainSeparator = _getDomainSeparator();

        // Create EIP-712 typed data hash for signing
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, keyNonce, keccak256(cipher)));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        // Sign the digest with the session key
        if (key.keyType == KeyType.P256) {
            bytes32 keyHash = _generateKeyIdentifier(key.keyType, key.publicKey);
            return _secp256r1Sig(privateKey, keyHash, false, digest);
        } else if (key.keyType == KeyType.WebAuthnP256) {
            bytes32 keyHash = _generateKeyIdentifier(key.keyType, key.publicKey);
            return _webauthnSig(privateKey, keyHash, false, digest);
        } else if (key.keyType == KeyType.Secp256k1) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
            return abi.encodePacked(r, s, v);
        } else {
            revert("unsupported key type");
        }
    }

    /// @notice Helper to execute a call via key
    /// @param account The account to execute the call on
    /// @param keyIndex The key index to use
    /// @param calls The encoded calls to execute
    /// @param privateKey The private key to sign with
    function _executeViaKey(address account, uint32 keyIndex, bytes memory calls, uint256 privateKey) internal {
        // Encrypt the calls
        (uint96 nonce, bytes memory cipher) = ShieldedDelegationAccount(account).encrypt(calls);

        // Sign the execution request
        bytes memory signature = _signExecuteDigestWithKey(account, keyIndex, cipher, privateKey);

        // Execute via relayer
        vm.prank(RELAY_ADDRESS);
        ShieldedDelegationAccount(account).execute(nonce, cipher, signature, keyIndex);
    }

    /// @notice Creates a secp256r1 signature
    /// @param privateKey The private key to sign with
    /// @param keyHash The key hash to sign with
    /// @param prehash Whether the digest is prehashed
    /// @param digest The digest to sign
    /// @return signature The signature bytes
    function _secp256r1Sig(uint256 privateKey, bytes32 keyHash, bool prehash, bytes32 digest)
        internal
        pure
        returns (bytes memory)
    {
        (bytes32 r, bytes32 s) = vm.signP256(privateKey, digest);
        s = P256.normalized(s);
        return abi.encodePacked(abi.encode(r, s), keyHash, uint8(prehash ? 1 : 0));
    }

    function _webauthnSig(uint256 privateKey, bytes32 keyHash, bool prehash, bytes32 digest)
        internal
        pure
        returns (bytes memory)
    {
        // Construct mock WebAuthn-style clientDataJSON with known layout
        string memory challengeEncoded = Base64.encode(abi.encodePacked(digest), true, true);
        string memory clientDataJSON =
            string(abi.encodePacked('{"type":"webauthn.get","challenge":"', challengeEncoded, '"}'));

        // Dummy authenticatorData (must be non-empty and at least 33 bytes for UP flag)
        bytes memory authenticatorData = new bytes(33);
        authenticatorData[32] = 0x01; // Set UP (user present) flag

        uint256 challengeIndex = 28; // fixed index for '"challenge":"'
        uint256 typeIndex = 8; // fixed index for '"type":"...'

        // Create digest of authenticatorData || SHA256(clientDataJSON)
        bytes32 clientHash = sha256(bytes(clientDataJSON));
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientHash));

        // Sign message hash with P256
        (bytes32 r, bytes32 s) = vm.signP256(privateKey, messageHash);
        s = P256.normalized(s);

        WebAuthn.WebAuthnAuth memory auth = WebAuthn.WebAuthnAuth({
            authenticatorData: authenticatorData,
            clientDataJSON: clientDataJSON,
            challengeIndex: challengeIndex,
            typeIndex: typeIndex,
            r: r,
            s: s
        });

        return abi.encode(auth, keyHash, uint8(prehash ? 1 : 0));
    }

    function _randomSecp256r1Key() internal returns (bytes memory publicKey, uint256 privateKey) {
        privateKey = _generateRandomNumber() & type(uint192).max;
        (uint256 x, uint256 y) = vm.publicKeyP256(privateKey);
        publicKey = abi.encode(x, y);
        return (publicKey, privateKey);
    }

    function _randomSecp256k1Key() internal returns (bytes memory publicKey, uint256 privateKey) {
        privateKey = _generateRandomNumber() & type(uint192).max;
        address addr = vm.addr(privateKey);
        publicKey = abi.encode(addr);
        return (publicKey, privateKey);
    }

    function _generateRandomNumber() internal view returns (uint256) {
        bytes memory personalization = abi.encodePacked("aes-key", block.timestamp);
        bytes memory input = abi.encodePacked(uint32(32), personalization);

        (bool success, bytes memory output) = address(0x64).staticcall(input);
        require(success, "RNG Precompile call failed");
        require(output.length == 32, "Invalid RNG output length");

        bytes32 randomBytes;
        assembly {
            randomBytes := mload(add(output, 32))
        }

        return uint256(randomBytes);
    }

    function _signAndAttachDelegation(address implementation) internal {
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(implementation, ALICE_PK);
        vm.broadcast(RELAY_PK);
        vm.attachDelegation(signedDelegation);
        vm.stopBroadcast();
    }

    //     ////////////////////////////////////////////////////////////////////////
    //     // Test Cases
    //     ////////////////////////////////////////////////////////////////////////

    /// @notice Test that setAESKey reverts if AES key is already initialized
    function test_setAESKey_ifAlreadyInitialized() public {
        vm.prank(ALICE_ADDRESS);
        // Initialize the AES key
        ShieldedDelegationAccount(ALICE_ADDRESS).setAESKey();

        // Try to initialize the AES key again
        vm.prank(ALICE_ADDRESS);
        vm.expectRevert("AES key already initialized");
        ShieldedDelegationAccount(ALICE_ADDRESS).setAESKey();
    }

    function test_authorizeAllKeyTypes() public {
        _test_authorizeKey(KeyType.P256);
        _test_authorizeKey(KeyType.WebAuthnP256);
        _test_authorizeKey(KeyType.Secp256k1);
    }

    function _test_authorizeKey(KeyType keyType) internal {
        (bytes memory publicKey,) = keyType == KeyType.Secp256k1 ? _randomSecp256k1Key() : _randomSecp256r1Key();

        vm.prank(ALICE_ADDRESS);
        uint32 keyIndex = ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey, uint40(block.timestamp + 24 hours), 1 ether
        );
        console.log("Authorized key type %s at index %s", uint8(keyType), keyIndex);

        Key memory key = ShieldedDelegationAccount(ALICE_ADDRESS).keys(keyIndex);

        assertEq(uint8(key.keyType), uint8(keyType), "Key type mismatch");
        assertEq(key.publicKey, publicKey, "Session signer should match");
        assertEq(key.expiry, block.timestamp + 24 hours, "Expiry should match");
        assertEq(key.spendLimit, 1 ether, "Limit should match");
        assertEq(key.spentWei, 0, "Spent amount should be zero initially");
        assertEq(key.nonce, 0, "Nonce should be zero initially");
    }

    function test_grantAndRevokeMultipleSessions_AllKeyTypes() public {
        _test_grantAndRevokeMultipleSessions(KeyType.P256);
        _test_grantAndRevokeMultipleSessions(KeyType.WebAuthnP256);
        _test_grantAndRevokeMultipleSessions(KeyType.Secp256k1);
    }

    function _test_grantAndRevokeMultipleSessions(KeyType keyType) internal {
        bytes memory publicKey1;
        bytes memory publicKey2;
        bytes memory publicKey3;

        if (keyType == KeyType.Secp256k1) {
            (publicKey1,) = _randomSecp256k1Key();
            (publicKey2,) = _randomSecp256k1Key();
            (publicKey3,) = _randomSecp256k1Key();
        } else {
            (publicKey1,) = _randomSecp256r1Key();
            (publicKey2,) = _randomSecp256r1Key();
            (publicKey3,) = _randomSecp256r1Key();
        }

        // Grant 3 sessions
        vm.startPrank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey1, uint40(block.timestamp + 1 hours), 1 ether
        );
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey2, uint40(block.timestamp + 2 hours), 1 ether
        );
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey3, uint40(block.timestamp + 3 hours), 1 ether
        );
        vm.stopPrank();

        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(keyType, publicKey1), 1);
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(keyType, publicKey2), 2);
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(keyType, publicKey3), 3);

        // Revoke key2
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeKey(keyType, publicKey2);

        // key3 should now be at index 2
        uint32 newIndexForKey3 = ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(keyType, publicKey3);
        assertEq(newIndexForKey3, 2, "key3 should now be at index 2");

        // key2 should be gone
        vm.expectRevert("key not found");
        ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(keyType, publicKey2);

        // Should have 2 keys
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).keyCount(), 2);

        // Revoke key1
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeKey(keyType, publicKey1);
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).keyCount(), 1);

        // Revoke key3
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeKey(keyType, publicKey3);
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).keyCount(), 0);
    }

    function test_revokeSessionWhenOnlyOneSessionExists_AllKeyTypes() public {
        _test_revokeSessionWhenOnlyOneSessionExists(KeyType.P256);
        _test_revokeSessionWhenOnlyOneSessionExists(KeyType.WebAuthnP256);
        _test_revokeSessionWhenOnlyOneSessionExists(KeyType.Secp256k1);
    }

    function _test_revokeSessionWhenOnlyOneSessionExists(KeyType keyType) internal {
        bytes memory publicKey1;
        bytes memory publicKey2;

        if (keyType == KeyType.Secp256k1) {
            (publicKey1,) = _randomSecp256k1Key();
            (publicKey2,) = _randomSecp256k1Key();
        } else {
            (publicKey1,) = _randomSecp256r1Key();
            (publicKey2,) = _randomSecp256r1Key();
        }

        vm.startPrank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey1, uint40(block.timestamp + 24 hours), 1 ether
        );
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey2, uint40(block.timestamp + 24 hours), 1 ether
        );
        vm.stopPrank();

        // Revoke key2
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeKey(keyType, publicKey2);

        // Revoke again: should revert
        vm.prank(ALICE_ADDRESS);
        vm.expectRevert("key not found");
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeKey(keyType, publicKey2);
    }

    // function test_storageCollisionResistance() public {
    //     // Step 1: Write a known value to _getStorage().aesKey
    //     uint256 testAESKey = 0xaabbccddeeff00112233445566778899;
    //     vm.prank(address(acc));
    //     acc.setAESKey();

    //     // Step 2: Derive the custom struct slot
    //     bytes32 baseHash = keccak256("SHIELDED_DELEGATION_STORAGE");
    //     uint256 customSlot = uint72(bytes9(baseHash)); // same logic as contract

    //     // Check the aesKey slot (offset 0 inside struct)
    //     bytes32 aesKeySlot = bytes32(customSlot + 0);
    //     bytes32 aesKeyRaw = vm.load(address(acc), aesKeySlot);
    //     assertEq(uint256(aesKeyRaw), testAESKey, "aesKey should be correctly stored");

    //     // Step 3: Check slot 0-10 to ensure no unintentional collision (these are Solidity-managed)
    //     for (uint256 i = 0; i < 10; i++) {
    //         if (i == customSlot) continue; // skip the actual struct base slot
    //         bytes32 otherSlotValue = vm.load(address(acc), bytes32(i));
    //         assertEq(uint256(otherSlotValue), 0, string.concat("Unexpected data in slot ", vm.toString(i)));
    //     }

    //     // Step 4: Check DOMAIN_SEPARATOR is not colliding with our custom layout
    //     bytes32 separatorSlot = bytes32(uint256(0)); // immutables go into bytecode, not SSTORE
    //     bytes32 rawSlot0 = vm.load(address(acc), separatorSlot);
    //     assertEq(uint256(rawSlot0), 0, "Slot 0 should be empty, immutables not stored here");

    //     // Step 5: Check unused slots near the struct (±10)
    //     for (uint256 i = 1; i <= 10; i++) {
    //         bytes32 high = vm.load(address(acc), bytes32(customSlot + i));
    //         bytes32 low = vm.load(address(acc), bytes32(customSlot - i));
    //         assertEq(high, 0, "Unexpected data above struct");
    //         assertEq(low, 0, "Unexpected data below struct");
    //     }
    // }

    function _resetBobBalance() internal {
        vm.prank(BOB_ADDRESS);
        uint256 bobBalance = tok.balanceOf();
        assertGt(bobBalance, 0, "Bob should have some balance");
        vm.prank(BOB_ADDRESS);
        tok.transfer(ALICE_ADDRESS, suint256(bobBalance));
    }

    function test_executeAsOwner_AllKeyTypes() public {
        _test_executeAsOwner(KeyType.P256);
        _resetBobBalance();
        _test_executeAsOwner(KeyType.WebAuthnP256);
        _resetBobBalance();
        _test_executeAsOwner(KeyType.Secp256k1);
        _resetBobBalance();
    }

    function _test_executeAsOwner(KeyType keyType) internal {
        bytes memory publicKey;
        if (keyType == KeyType.Secp256k1) {
            (publicKey,) = _randomSecp256k1Key();
        } else {
            (publicKey,) = _randomSecp256r1Key();
        }

        // Grant session key
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey, uint40(block.timestamp + 24 hours), 1 ether
        );

        // Prepare token transfer call
        bytes memory calls = _createTokenTransferCall(BOB_ADDRESS, 5 * 10 ** 18);

        // Encrypt calls
        (uint96 nonce, bytes memory cipher) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

        // Call as owner — signature and key index are ignored
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).execute(nonce, cipher, bytes(""), 1);

        // Verify transfer
        vm.prank(BOB_ADDRESS);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 5 * 10 ** 18, "Bob should have received 5 tokens");
    }

    function test_execute_AllKeyTypes() public {
        _test_execute(KeyType.P256);
        _resetBobBalance();

        // _test_execute(KeyType.WebAuthnP256);
        // _resetBobBalance();

        _test_execute(KeyType.Secp256k1);
    }

    function _test_execute(KeyType keyType) internal {
        (bytes memory publicKey, uint256 privateKey) =
            keyType == KeyType.Secp256k1 ? _randomSecp256k1Key() : _randomSecp256r1Key();

        // Grant a session
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey, uint40(block.timestamp + 24 hours), 1 ether
        );

        // Create token transfer call
        bytes memory calls = _createTokenTransferCall(BOB_ADDRESS, 5 * 10 ** 18);
        (uint96 nonce, bytes memory cipher) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

        // Get key metadata
        uint32 keyIndex = ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(keyType, publicKey);
        uint256 keyNonce = ShieldedDelegationAccount(ALICE_ADDRESS).getKeyNonce(keyIndex);
        bytes32 domainSeparator = _getDomainSeparator();
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, keyNonce, keccak256(cipher)));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        // Generate signature
        bytes memory signature;
        if (keyType == KeyType.Secp256k1) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
            signature = abi.encodePacked(r, s, v);
        } else if (keyType == KeyType.P256) {
            signature = _secp256r1Sig(privateKey, digest, false, digest);
        } else {
            signature = _webauthnSig(privateKey, digest, false, digest);
        }
        // Execute as relayer
        vm.prank(RELAY_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).execute(nonce, cipher, signature, keyIndex);

        // Verify tokens transferred
        vm.prank(BOB_ADDRESS);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 5 * 10 ** 18, "Bob should have received 5 tokens");
    }

    function test_execute() public {
        (bytes memory publicKey, uint256 privateKey) = _randomSecp256r1Key();
        // Grant a session
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            KeyType.P256, publicKey, uint40(block.timestamp + 24 hours), 1 ether
        );

        // Create the token transfer call
        bytes memory calls = _createTokenTransferCall(BOB_ADDRESS, 5 * 10 ** 18);

        // Encrypt and verify decryption works properly
        (uint96 encryptedCallsNonce, bytes memory encryptedCalls) =
            ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

        // Get key index for signing
        uint32 keyIndex = ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(KeyType.P256, publicKey);

        // Get key nonce for signing
        uint256 keyNonce = ShieldedDelegationAccount(ALICE_ADDRESS).getKeyNonce(keyIndex);

        // Generate domain separator
        bytes32 DOMAIN_SEPARATOR = _getDomainSeparator();

        // Create and sign digest
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, keyNonce, keccak256(encryptedCalls)));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        bytes memory signature = _secp256r1Sig(privateKey, digest, false, digest);

        // Execute the transaction
        vm.prank(RELAY_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).execute(encryptedCallsNonce, encryptedCalls, signature, keyIndex);

        // Verify Bob received the tokens
        vm.prank(BOB_ADDRESS);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 5 * 10 ** 18, "Bob should have received 5 tokens");
    }

    /// @notice Test that execution is rejected when session has expired
    function test_revertWhenSessionExpired() public {
        (bytes memory publicKey, uint256 privateKey) = _randomSecp256r1Key();
        // Authorize a key
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            KeyType.P256, publicKey, uint40(block.timestamp + 24 hours), 1 ether
        );

        // Advance time past expiration
        vm.warp(block.timestamp + 24 hours + 1 hours);

        // Create token transfer call
        bytes memory calls = _createTokenTransferCall(BOB_ADDRESS, 5 * 10 ** 18);

        // Encrypt the call data
        (uint96 encryptedCallsNonce, bytes memory encryptedCalls) =
            ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

        // Get key index for signing
        uint32 keyIndex = ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(KeyType.P256, publicKey);

        // Sign the execution request
        bytes memory signature = _signExecuteDigestWithKey(ALICE_ADDRESS, keyIndex, encryptedCalls, privateKey);

        // Execution should revert due to expired session
        vm.prank(RELAY_ADDRESS);
        vm.expectRevert("key expired");
        ShieldedDelegationAccount(ALICE_ADDRESS).execute(encryptedCallsNonce, encryptedCalls, signature, keyIndex);

        // Verify Bob didn't receive any tokens
        vm.prank(BOB_ADDRESS);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 0, "Bob should not have received any tokens");
    }

    /// @notice Test that the session spending limit is enforced
    function test_ethSessionLimit() public {
        (bytes memory publicKey, uint256 privateKey) = _randomSecp256r1Key();
        // Fund Alice with 100 ETH
        vm.deal(ALICE_ADDRESS, 100 ether);

        // Grant session with 10 ETH limit
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            KeyType.P256, publicKey, uint40(block.timestamp + 24 hours), 10 ether
        );

        uint32 keyIndex = ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(KeyType.P256, publicKey);

        // Record Bob's initial balance
        uint256 initialBalance = BOB_ADDRESS.balance;

        // Test 1: First transfer of 6 ETH (should succeed)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 6 ether);
            _executeViaKey(ALICE_ADDRESS, keyIndex, calls, privateKey);
            assertEq(BOB_ADDRESS.balance, initialBalance + 6 ether, "First transfer should succeed");
        }

        // Test 2: Second transfer of 3 ETH (should succeed)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 3 ether);
            _executeViaKey(ALICE_ADDRESS, keyIndex, calls, privateKey);
            assertEq(BOB_ADDRESS.balance, initialBalance + 9 ether, "Second transfer should succeed");
        }

        // Test 3: Third transfer of 2 ETH (should fail - would exceed limit)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 2 ether);

            (uint96 nonce96, bytes memory cipher) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

            // Sign the execution request
            bytes memory signature = _signExecuteDigestWithKey(ALICE_ADDRESS, keyIndex, cipher, privateKey);

            vm.prank(RELAY_ADDRESS);
            vm.expectRevert("spend limit exceeded");
            ShieldedDelegationAccount(ALICE_ADDRESS).execute(nonce96, cipher, signature, keyIndex);

            assertEq(BOB_ADDRESS.balance, initialBalance + 9 ether, "Balance should not change after failed transfer");
        }

        // Test 4: Small transfer of 1 ETH (should succeed - exactly reaches limit)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 1 ether);
            _executeViaKey(ALICE_ADDRESS, keyIndex, calls, privateKey);
            assertEq(BOB_ADDRESS.balance, initialBalance + 10 ether, "Should allow transfer that exactly reaches limit");
        }

        // Test 5: Final tiny transfer (should fail - exceeds limit)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 0.1 ether);

            (uint96 nonce96, bytes memory cipher) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

            // Sign the execution request
            bytes memory signature = _signExecuteDigestWithKey(ALICE_ADDRESS, keyIndex, cipher, privateKey);

            vm.prank(RELAY_ADDRESS);
            vm.expectRevert("spend limit exceeded");
            ShieldedDelegationAccount(ALICE_ADDRESS).execute(nonce96, cipher, signature, keyIndex);

            assertEq(BOB_ADDRESS.balance, initialBalance + 10 ether, "No more transfers should be possible");
        }
    }
}
