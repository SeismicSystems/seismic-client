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

    /// @notice Verifies the AES key storage
    /// @param baseSlot The base slot to verify
    function _verifyAESKeyStorage(uint256 baseSlot) internal view {
        // Check aesKey is set (slot 0)
        bytes32 aesKey = vm.load(ALICE_ADDRESS, bytes32(baseSlot));
        assertTrue(uint256(aesKey) != 0, "aesKey should be set");

        // Check aesKeyInitialized is true (slot 1)
        bytes32 initialized = vm.load(ALICE_ADDRESS, bytes32(baseSlot + 1));
        assertEq(uint256(initialized) & 0xFF, 1, "aesKeyInitialized should be true");
    }

    /// @notice Verifies the keys array storage
    /// @param baseSlot The base slot to verify
    function _verifyKeysArrayStorage(uint256 baseSlot) internal view {
        // Check keys array length (slot 2)
        bytes32 length = vm.load(ALICE_ADDRESS, bytes32(baseSlot + 2));
        assertEq(uint256(length), 2, "Should have 2 keys");

        // Check first key data
        bytes32 keysSlot = keccak256(abi.encode(baseSlot + 2));
        bytes32 firstKeyData = vm.load(ALICE_ADDRESS, keysSlot);

        // Extract packed data from first slot of first key
        uint40 expiry = uint40(uint256(firstKeyData));
        uint8 keyType = uint8(uint256(firstKeyData) >> 40);
        bool authorized = uint8(uint256(firstKeyData) >> 48) == 1;

        assertTrue(expiry > block.timestamp, "Key should not be expired");
        assertEq(keyType, uint8(KeyType.P256), "First key should be P256");
        assertTrue(authorized, "Key should be authorized");
    }

    /// @notice Verifies the mapping storage
    /// @param baseSlot The base slot to verify
    function _verifyMappingStorage(uint256 baseSlot) internal view {
        // Create the same key identifier that was used
        bytes32 keyHash = _generateKeyIdentifier(KeyType.P256, abi.encode(uint256(1), uint256(2)));

        // Calculate mapping slot
        bytes32 mappingSlot = keccak256(abi.encode(keyHash, baseSlot + 3));
        bytes32 mappingValue = vm.load(ALICE_ADDRESS, mappingSlot);

        // Should map to index 1 (first key)
        assertEq(uint256(mappingValue), 1, "Mapping should point to first key");
    }

    /// @notice Verifies no standard slot collision
    /// @param baseSlot The base slot to verify
    function _verifyNoStandardSlotCollision(uint256 baseSlot) internal view {
        // Check slots 0-10 (excluding our base slot)
        for (uint256 i = 0; i < 10; i++) {
            if (i == baseSlot) continue;

            bytes32 value = vm.load(ALICE_ADDRESS, bytes32(i));
            assertEq(uint256(value), 0, string.concat("Slot ", vm.toString(i), " should be empty"));
        }

        // Check common proxy slots
        uint256[3] memory proxySlots = [
            uint256(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc), // EIP-1967 implementation
            uint256(keccak256("implementation")),
            uint256(keccak256("admin"))
        ];

        for (uint256 i = 0; i < proxySlots.length; i++) {
            if (proxySlots[i] == baseSlot) continue;

            bytes32 value = vm.load(ALICE_ADDRESS, bytes32(proxySlots[i]));
            assertEq(uint256(value), 0, "Proxy slot should be empty");
        }
    }

    /// @notice Verifies storage isolation
    /// @param baseSlot The base slot to verify
    function _verifyStorageIsolation(uint256 baseSlot) internal {
        // Store initial AES key value
        bytes32 initialAesKey = vm.load(ALICE_ADDRESS, bytes32(baseSlot));

        // Execute with first key to update its nonce
        bytes memory calls = _createTokenTransferCall(BOB_ADDRESS, 0.1 * 10 ** 18);
        (uint96 nonce, bytes memory cipher) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

        // Create a simple signature for key index 1
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).execute(nonce, cipher, bytes(""), 1);

        // Verify AES key unchanged
        bytes32 finalAesKey = vm.load(ALICE_ADDRESS, bytes32(baseSlot));
        assertEq(finalAesKey, initialAesKey, "AES key should not change");

        // Verify key array length unchanged
        bytes32 length = vm.load(ALICE_ADDRESS, bytes32(baseSlot + 2));
        assertEq(uint256(length), 2, "Keys array length should remain 2");
    }

    /// @notice Resets Bob's balance
    function _resetBobBalance() internal {
        vm.prank(BOB_ADDRESS);
        uint256 bobBalance = tok.balanceOf();
        assertGt(bobBalance, 0, "Bob should have some balance");
        vm.prank(BOB_ADDRESS);
        tok.transfer(ALICE_ADDRESS, suint256(bobBalance));
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
    function _signExecuteDigestWithKey(
        address payable account,
        uint32 keyIndex,
        bytes memory cipher,
        uint256 privateKey
    ) internal view returns (bytes memory signature) {
        uint256 keyNonce = ShieldedDelegationAccount(account).getKeyNonce(keyIndex);
        Key memory key = ShieldedDelegationAccount(account).getKey(keyIndex);
        bytes32 domainSeparator = _getDomainSeparator();

        // Create EIP-712 typed data hash for signing
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, keyNonce, keccak256(cipher)));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        // Sign the digest with the session key
        if (key.keyType == KeyType.P256) {
            bytes32 keyHash = _generateKeyIdentifier(key.keyType, key.publicKey);
            return _secp256r1Sig(privateKey, keyHash, false, digest);
        } else if (key.keyType == KeyType.WebAuthnP256) {
            return _webauthnSig(privateKey, digest);
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
    function _executeViaKey(address payable account, uint32 keyIndex, bytes memory calls, uint256 privateKey)
        internal
    {
        // Encrypt the calls
        (uint96 nonce, bytes memory cipher) = ShieldedDelegationAccount(account).encrypt(calls);

        // Sign the execution request
        bytes memory signature = _signExecuteDigestWithKey(account, keyIndex, cipher, privateKey);

        // Execute via relayer
        vm.prank(RELAY_ADDRESS);
        ShieldedDelegationAccount(account).execute(nonce, cipher, signature, keyIndex);
    }

    /// @notice Helper to execute a transparent (non-shielded) call via key
    /// @param account The account to execute the call on
    /// @param keyIndex The key index to use
    /// @param calls The encoded calls to execute
    /// @param privateKey The private key to sign with
    /// @param expectSpendLimitRevert Whether to expect a spend limit revert
    function _executeViaKeyTransparent(
        address payable account,
        uint32 keyIndex,
        bytes memory calls,
        uint256 privateKey,
        bool expectSpendLimitRevert
    ) internal {
        // Sign the execution request
        bytes memory signature = _signExecuteDigestWithKey(account, keyIndex, calls, privateKey);

        // Execute via relayer
        if (expectSpendLimitRevert) {
            vm.expectRevert("spend limit exceeded");
            vm.prank(RELAY_ADDRESS);
            ShieldedDelegationAccount(account).execute(uint96(0), calls, signature, keyIndex);
        } else {
            vm.prank(RELAY_ADDRESS);
            ShieldedDelegationAccount(account).execute(uint96(0), calls, signature, keyIndex);
        }
    }

    /// @notice Samples a random uniform short bytes
    /// @return result The sampled bytes
    function _sampleRandomUniformShortBytes() internal view returns (bytes memory result) {
        uint256 n = _generateRandomNumber();
        uint256 r = _generateRandomNumber();
        /// @solidity memory-safe-assembly
        assembly {
            switch and(0xf, byte(0, n))
            case 0 { n := and(n, 0x3f) }
            default { n := and(n, 0x3) }
            result := mload(0x40)
            mstore(result, n)
            mstore(add(0x20, result), r)
            mstore(add(0x40, result), keccak256(result, 0x40))
            mstore(0x40, add(result, 0x80))
        }
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

    /// @notice Creates a WebAuthn signature
    /// @param privateKey The private key to sign with
    /// @param digest The digest to sign
    /// @return signature The signature bytes
    function _webauthnSig(uint256 privateKey, bytes32 digest) internal pure returns (bytes memory) {
        // STEP 1: The contract passes abi.encode(digest) as the challenge
        bytes memory challenge = abi.encode(digest);

        // STEP 2: Create the authenticatorData (using the same format as the trace)
        bytes memory authenticatorData = hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d9763050000010a";

        // STEP 3: Create the clientDataJSON with the encoded challenge
        string memory clientDataJSON = string(
            abi.encodePacked(
                '{"type":"webauthn.get","challenge":"',
                Base64.encode(challenge, true, true),
                '","origin":"http://localhost:3005","crossOrigin":false}'
            )
        );

        // STEP 4: Calculate the message hash according to WebAuthn spec
        // messageHash = sha256(authenticatorData || sha256(clientDataJSON))
        bytes32 clientDataHash = sha256(bytes(clientDataJSON));
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientDataHash));

        // STEP 5: Sign the messageHash (NOT the digest!)
        (bytes32 r, bytes32 s) = vm.signP256(privateKey, messageHash);
        s = P256.normalized(s);

        // STEP 6: Create the WebAuthnAuth struct
        WebAuthn.WebAuthnAuth memory auth = WebAuthn.WebAuthnAuth({
            authenticatorData: authenticatorData,
            clientDataJSON: clientDataJSON,
            challengeIndex: 23, // Position where challenge value starts in the JSON
            typeIndex: 1, // Position where type value starts in the JSON
            r: r,
            s: s
        });

        // STEP 7: Return the encoded auth struct
        return abi.encode(auth);
    }

    /// @notice Generates a random secp256r1 key
    /// @return publicKey The public key
    /// @return privateKey The private key
    function _randomSecp256r1Key() internal view returns (bytes memory publicKey, uint256 privateKey) {
        privateKey = _generateRandomNumber() & type(uint192).max;
        (uint256 x, uint256 y) = vm.publicKeyP256(privateKey);
        publicKey = abi.encode(x, y);
        return (publicKey, privateKey);
    }

    /// @notice Generates a random secp256k1 key
    /// @return publicKey The public key
    /// @return privateKey The private key
    function _randomSecp256k1Key() internal view returns (bytes memory publicKey, uint256 privateKey) {
        privateKey = _generateRandomNumber() & type(uint192).max;
        address addr = vm.addr(privateKey);
        publicKey = abi.encode(addr);
        return (publicKey, privateKey);
    }

    /// @notice Generates a random uint256 number
    /// @return randomBytes The random number
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

    /// @notice Signs, attaches and broadcasts a delegation
    /// @param implementation The implementation address
    function _signAndAttachDelegation(address implementation) internal {
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(implementation, ALICE_PK);
        vm.broadcast(RELAY_PK);
        vm.attachDelegation(signedDelegation);
        vm.stopBroadcast();
    }

    ////////////////////////////////////////////////////////////////////////
    // Test Functions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Tests the authorizeKey function
    /// @param keyType The key type to authorize
    function _test_authorizeKey(KeyType keyType) internal {
        // Generate a random public key, depending on the key type
        (bytes memory publicKey,) = keyType == KeyType.Secp256k1 ? _randomSecp256k1Key() : _randomSecp256r1Key();

        // Authorize the key
        vm.prank(ALICE_ADDRESS);
        uint32 keyIndex = ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey, uint40(block.timestamp + 24 hours), 1 ether
        );

        Key memory key = ShieldedDelegationAccount(ALICE_ADDRESS).getKey(keyIndex);

        // Verify the key properties
        assertEq(uint8(key.keyType), uint8(keyType), "Key type mismatch");
        assertEq(key.publicKey, publicKey, "Session signer should match");
        assertEq(key.expiry, block.timestamp + 24 hours, "Expiry should match");
        assertEq(key.spendLimit, 1 ether, "Limit should match");
        assertEq(key.spentWei, 0, "Spent amount should be zero initially");
        assertEq(key.nonce, 0, "Nonce should be zero initially");
    }

    /// @notice Tests the grantAndRevokeMultipleSessions function
    /// @param keyType The key type to grant and revoke
    function _test_grantAndRevokeMultipleSessions(KeyType keyType) internal {
        // Generate 3 random public keys, depending on the key type
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

    /// @notice Tests the revokeSessionWhenOnlyOneSessionExists function
    /// @param keyType The key type to revoke
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

    /// @notice Tests the executeAsOwner function
    /// @param keyType The key type to execute as owner
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

    /// @notice Tests the execute function
    /// @param keyType The key type to execute
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
            signature = _webauthnSig(privateKey, digest);
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

    /// @notice Tests the verifyAndConsumeNonce function
    /// @param keyType The key type to verify and consume nonce
    function _test_verifyAndConsumeNonce(KeyType keyType) internal {
        // Get key pair based on type
        (bytes memory publicKey, uint256 privateKey) =
            keyType == KeyType.Secp256k1 ? _randomSecp256k1Key() : _randomSecp256r1Key();

        // Authorize a key
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            keyType, publicKey, uint40(block.timestamp + 24 hours), 1 ether
        );

        uint32 keyIndex = ShieldedDelegationAccount(ALICE_ADDRESS).getKeyIndex(keyType, publicKey);

        // Create an arbitrary message
        bytes memory message = "Hello World";

        // Get domain separator
        bytes32 domainSeparator = ShieldedDelegationAccount(ALICE_ADDRESS).getDomainSeparator();

        // Get current nonce
        uint256 nonce = ShieldedDelegationAccount(ALICE_ADDRESS).getKeyNonce(keyIndex);

        // Create signature
        bytes32 digest = _hashTypedDataV4(nonce, message, domainSeparator);
        bytes memory signature;
        if (keyType == KeyType.P256) {
            signature = _secp256r1Sig(privateKey, _generateKeyIdentifier(KeyType.P256, publicKey), false, digest);
        } else if (keyType == KeyType.WebAuthnP256) {
            signature = _webauthnSig(privateKey, digest);
        } else if (keyType == KeyType.Secp256k1) {
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
            signature = abi.encodePacked(r, s, v);
        }

        // First verification should succeed
        vm.prank(ADMIN_ADDRESS);
        bool success = ShieldedDelegationAccount(ALICE_ADDRESS).verifyAndConsumeNonce(keyIndex, message, signature);
        assertTrue(success, "First verification should succeed");

        // Attempt replay attack - should fail
        vm.prank(ADMIN_ADDRESS);
        vm.expectRevert("invalid sig");
        ShieldedDelegationAccount(ALICE_ADDRESS).verifyAndConsumeNonce(keyIndex, message, signature);

        // Verify nonce was incremented
        assertEq(
            ShieldedDelegationAccount(ALICE_ADDRESS).getKeyNonce(keyIndex), nonce + 1, "Nonce should be incremented"
        );
    }

    ////////////////////////////////////////////////////////////////////////
    // Test Cases
    ////////////////////////////////////////////////////////////////////////

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

    /// @notice Tests the storage collision resistance
    function test_storageCollisionResistance() public {
        // Initialize AES key
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).setAESKey();

        // Add test keys
        vm.startPrank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            KeyType.P256,
            abi.encode(uint256(1), uint256(2)), // dummy public key
            uint40(block.timestamp + 24 hours),
            1 ether
        );
        ShieldedDelegationAccount(ALICE_ADDRESS).authorizeKey(
            KeyType.Secp256k1,
            abi.encode(address(0x1234)), // dummy public key
            uint40(block.timestamp + 48 hours),
            2 ether
        );
        vm.stopPrank();

        // Calculate base slot
        uint256 slot = uint72(bytes9(keccak256("SHIELDED_DELEGATION_STORAGE")));

        // Test 1: Verify AES key storage
        _verifyAESKeyStorage(slot);

        // Test 2: Verify keys array storage
        _verifyKeysArrayStorage(slot);

        // Test 3: Verify mapping storage
        _verifyMappingStorage(slot);

        // Test 4: Verify no collision with standard slots
        _verifyNoStandardSlotCollision(slot);

        // Test 5: Verify storage isolation after operations
        _verifyStorageIsolation(slot);
    }

    /// @notice Tests the authorizeKey function for all key types
    function test_authorizeAllKeyTypes() public {
        // P256
        _test_authorizeKey(KeyType.P256);
        // WebAuthnP256
        _test_authorizeKey(KeyType.WebAuthnP256);
        // Secp256k1
        _test_authorizeKey(KeyType.Secp256k1);
    }

    /// @notice Tests the grantAndRevokeMultipleSessions function for all key types
    function test_grantAndRevokeMultipleSessions_AllKeyTypes() public {
        // P256
        _test_grantAndRevokeMultipleSessions(KeyType.P256);
        // WebAuthnP256
        _test_grantAndRevokeMultipleSessions(KeyType.WebAuthnP256);
        // Secp256k1
        _test_grantAndRevokeMultipleSessions(KeyType.Secp256k1);
    }

    /// @notice Tests the revokeSessionWhenOnlyOneSessionExists function for all key types
    function test_revokeSessionWhenOnlyOneSessionExists_AllKeyTypes() public {
        // P256
        _test_revokeSessionWhenOnlyOneSessionExists(KeyType.P256);
        // WebAuthnP256
        _test_revokeSessionWhenOnlyOneSessionExists(KeyType.WebAuthnP256);
        // Secp256k1
        _test_revokeSessionWhenOnlyOneSessionExists(KeyType.Secp256k1);
    }

    function test_executeAsOwner_AllKeyTypes() public {
        // P256
        _test_executeAsOwner(KeyType.P256);
        // reset Bob's balance back to 0 since we expect that 5 tokens were transferred
        _resetBobBalance();
        // WebAuthnP256
        _test_executeAsOwner(KeyType.WebAuthnP256);
        // reset Bob's balance back to 0 since we expect that 5 tokens were transferred
        _resetBobBalance();
        // Secp256k1
        _test_executeAsOwner(KeyType.Secp256k1);
    }

    function test_execute_AllKeyTypes() public {
        // P256
        _test_execute(KeyType.P256);
        // reset Bob's balance back to 0 since we expect that 5 tokens were transferred
        _resetBobBalance();
        // WebAuthnP256
        _test_execute(KeyType.WebAuthnP256);
        // reset Bob's balance back to 0 since we expect that 5 tokens were transferred
        _resetBobBalance();
        // Secp256k1
        _test_execute(KeyType.Secp256k1);
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

    /// @notice Tests the verifyAndConsumeNonce function for all key types
    function test_verifyAndConsumeNonce_AllKeyTypes() public {
        // P256
        _test_verifyAndConsumeNonce(KeyType.P256);
        // WebAuthnP256
        _test_verifyAndConsumeNonce(KeyType.WebAuthnP256);
        // Secp256k1
        _test_verifyAndConsumeNonce(KeyType.Secp256k1);
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
            _executeViaKeyTransparent(ALICE_ADDRESS, keyIndex, calls, privateKey, false);
            assertEq(BOB_ADDRESS.balance, initialBalance + 6 ether, "First transfer should succeed");
        }

        // Test 2: Second transfer of 3 ETH (should succeed)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 3 ether);
            _executeViaKeyTransparent(ALICE_ADDRESS, keyIndex, calls, privateKey, false);
            assertEq(BOB_ADDRESS.balance, initialBalance + 9 ether, "Second transfer should succeed");
        }

        // Test 3: Third transfer of 2 ETH (should fail - would exceed limit)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 2 ether);
            _executeViaKeyTransparent(ALICE_ADDRESS, keyIndex, calls, privateKey, true);
            assertEq(BOB_ADDRESS.balance, initialBalance + 9 ether, "Balance should not change after failed transfer");
        }

        // Test 4: Small transfer of 1 ETH (should succeed - exactly reaches limit)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 1 ether);
            _executeViaKeyTransparent(ALICE_ADDRESS, keyIndex, calls, privateKey, false);
            assertEq(BOB_ADDRESS.balance, initialBalance + 10 ether, "Should allow transfer that exactly reaches limit");
        }

        // Test 5: Final tiny transfer (should fail - exceeds limit)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 0.1 ether);
            _executeViaKeyTransparent(ALICE_ADDRESS, keyIndex, calls, privateKey, true);
            assertEq(BOB_ADDRESS.balance, initialBalance + 10 ether, "No more transfers should be possible");
        }
    }

    function test_receiveEth() public {
        vm.deal(BOB_ADDRESS, 10 ether);

        assertEq(ALICE_ADDRESS.balance, 0 ether);

        vm.prank(BOB_ADDRESS);
        bool success = ALICE_ADDRESS.send(1 ether);
        assertTrue(success, "Transfer failed");
        assertEq(ALICE_ADDRESS.balance, 1 ether, "ShieldedDelegationAccount should forward the ETH to the EOA");
    }
}
