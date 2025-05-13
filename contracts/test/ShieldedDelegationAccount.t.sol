// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/session-keys/ShieldedDelegationAccount.sol";
import "../src/utils/TestToken.sol";

/// @title ShieldedDelegationAccountTest
/// @notice Test suite for ShieldedDelegationAccount contract
/// @dev Uses Foundry's Test contract for assertions and utilities
contract ShieldedDelegationAccountTest is Test {
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

    /// @dev Address derived from session key
    address SKaddr;

    /// @dev Test addresses for operations
    address constant alice = address(0xA11CE);
    address constant bob = address(0xB0B);
    address constant relayer = address(0xAA);

    /// @dev AES key for encryption operations
    suint256 AES_KEY = suint256(0x2dc875f35f6fa751d30fc934bbf5027760109521adf5f66c9426002180f32bce);

    ////////////////////////////////////////////////////////////////////////
    // EIP-712 Constants
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

        // Deploy the delegation account and set the AES key
        acc = new ShieldedDelegationAccount();
        vm.prank(address(acc));
        acc.setAESKey(suint256(AES_KEY));

        // Deploy the test token and mint tokens to Alice and the account
        tok = new TestToken();
        tok.mint(saddress(address(alice)), suint256(100 * 10 ** 18));
        tok.mint(saddress(address(acc)), suint256(100 * 10 ** 18));
    }

    ////////////////////////////////////////////////////////////////////////
    // Utility Functions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Helper function to decrypt using the master key
    /// @dev Uses the same key as the contract for testing purposes
    /// @param nonce Random nonce that was used during encryption
    /// @param ciphertext The ciphertext to decrypt
    /// @return plaintext The decrypted result
    function _decrypt(uint96 nonce, bytes memory ciphertext) internal view returns (bytes memory plaintext) {
        require(ciphertext.length > 0, "Ciphertext cannot be empty");

        address AESDecryptAddr = address(0x67);

        // Pack key, nonce, and ciphertext
        bytes memory input = abi.encodePacked(suint256(AES_KEY), nonce, ciphertext);

        (bool success, bytes memory output) = AESDecryptAddr.staticcall(input);
        require(success, "AES decrypt precompile call failed");

        return output;
    }

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

    /// @notice Creates and signs a digest for the execute function
    /// @param sessionIndex Index of the session to use
    /// @param cipher Encrypted data to be executed
    /// @return signature The signature bytes
    function _signExecuteDigest(uint32 sessionIndex, bytes memory cipher)
        internal
        view
        returns (bytes memory signature)
    {
        uint256 sessionNonce = acc.getSessionNonce(sessionIndex);
        bytes32 domainSeparator = _getDomainSeparator();

        // Create EIP-712 typed data hash for signing
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, sessionNonce, keccak256(cipher)));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));

        // Sign the digest with the session key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
        return abi.encodePacked(r, s, v);
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

    /// @notice Helper to execute a call via session
    /// @param sessionIndex The session index to use
    /// @param calls The encoded calls to execute
    function _executeViaSession(uint32 sessionIndex, bytes memory calls) internal {
        // Encrypt the calls
        (uint96 nonce, bytes memory cipher) = acc.encrypt(calls);

        // Sign the execution request
        bytes memory signature = _signExecuteDigest(sessionIndex, cipher);

        // Execute via relayer
        vm.prank(relayer);
        acc.execute(nonce, cipher, signature, sessionIndex);
    }

    ////////////////////////////////////////////////////////////////////////
    // Test Cases
    ////////////////////////////////////////////////////////////////////////

    /// @notice Test granting a session with expiry and limit
    function test_grantSession() public {
        // Grant a session that expires in 24 hours with 1 ETH limit
        vm.prank(address(acc));
        acc.grantSession(SKaddr, block.timestamp + 24 hours, 1 ether);

        // Access the session data from storage
        (bool authorized, address signer, uint256 expiry, uint256 limitWei, uint256 spentWei, uint256 nonce) =
            acc.sessions(0);

        // Verify all fields
        assertEq(authorized, true, "Session should be authorized");
        assertEq(signer, SKaddr, "Session signer should match");
        assertEq(expiry, block.timestamp + 24 hours, "Expiry should match");
        assertEq(limitWei, 1 ether, "Limit should match");
        assertEq(spentWei, 0, "Spent amount should be zero initially");
        assertEq(nonce, 0, "Nonce should be zero initially");
    }

    /// @notice Test the encryption and decryption functionality
    function test_encrypt() public view {
        // Test data to encrypt
        bytes memory testData = bytes("ABCD");

        // Encrypt using the contract's function
        (uint96 n, bytes memory c) = acc.encrypt(testData);

        // Decrypt and verify the data matches
        bytes memory decrypted = _decrypt(n, c);
        assertEq(decrypted, testData, "Decrypted data should match original");
    }

    /// @notice Test executing a token transfer via session
    function test_execute() public {
        // Grant a session
        vm.prank(address(acc));
        acc.grantSession(SKaddr, block.timestamp + 24 hours, 1 ether);

        // Create the token transfer call
        bytes memory calls = _createTokenTransferCall(bob, 5 * 10 ** 18);

        // Encrypt and verify decryption works properly
        (uint96 encryptedCallsNonce, bytes memory encryptedCalls) = acc.encrypt(calls);
        bytes memory decrypted = _decrypt(encryptedCallsNonce, encryptedCalls);
        assertEq(decrypted, calls, "Decrypted calls should match original");

        // Get session nonce for signing
        uint256 sessionNonce = acc.getSessionNonce(0);

        // Generate domain separator
        bytes32 DOMAIN_SEPARATOR = _getDomainSeparator();

        // Create and sign digest
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, sessionNonce, keccak256(encryptedCalls)));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Execute the transaction
        vm.prank(relayer);
        acc.execute(encryptedCallsNonce, encryptedCalls, signature, 0);

        // Verify Bob received the tokens
        vm.prank(bob);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 5 * 10 ** 18, "Bob should have received 5 tokens");
    }

    /// @notice Test that execution is rejected when session has expired
    function test_revertWhenSessionExpired() public {
        // Grant a session
        vm.prank(address(acc));
        acc.grantSession(SKaddr, block.timestamp + 24 hours, 1 ether);

        // Advance time past expiration
        vm.warp(block.timestamp + 24 hours + 1 hours);

        // Create token transfer call
        bytes memory calls = _createTokenTransferCall(bob, 5 * 10 ** 18);

        // Encrypt the call data
        (uint96 encryptedCallsNonce, bytes memory encryptedCalls) = acc.encrypt(calls);

        // Sign the execution request
        bytes memory signature = _signExecuteDigest(0, encryptedCalls);

        // Execution should revert due to expired session
        vm.prank(relayer);
        vm.expectRevert("expired");
        acc.execute(encryptedCallsNonce, encryptedCalls, signature, 0);

        // Verify Bob didn't receive any tokens
        vm.prank(bob);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 0, "Bob should not have received any tokens");
    }

    /// @notice Test that the session spending limit is enforced
    function test_ethSessionLimit() public {
        // Fund the account contract with ETH
        vm.deal(address(acc), 100 ether);

        // Grant session with 10 ETH limit
        vm.prank(address(acc));
        acc.grantSession(SKaddr, block.timestamp + 24 hours, 10 ether);

        // Record Bob's initial balance
        uint256 initialBalance = address(bob).balance;

        // Test 1: First transfer of 6 ETH (should succeed)
        {
            bytes memory calls = _createEthTransferCall(bob, 6 ether);
            _executeViaSession(0, calls);
            assertEq(address(bob).balance, initialBalance + 6 ether, "First transfer should succeed");
        }

        // Test 2: Second transfer of 3 ETH (should succeed)
        {
            bytes memory calls = _createEthTransferCall(bob, 3 ether);
            _executeViaSession(0, calls);
            assertEq(address(bob).balance, initialBalance + 9 ether, "Second transfer should succeed");
        }

        // Test 3: Third transfer of 2 ETH (should fail - would exceed limit)
        {
            bytes memory calls = _createEthTransferCall(bob, 2 ether);

            (uint96 nonce96, bytes memory cipher) = acc.encrypt(calls);
            bytes memory signature = _signExecuteDigest(0, cipher);

            vm.prank(relayer);
            vm.expectRevert("spend limit exceeded");
            acc.execute(nonce96, cipher, signature, 0);

            assertEq(address(bob).balance, initialBalance + 9 ether, "Balance should not change after failed transfer");
        }

        // Test 4: Small transfer of 1 ETH (should succeed - exactly reaches limit)
        {
            bytes memory calls = _createEthTransferCall(bob, 1 ether);
            _executeViaSession(0, calls);
            assertEq(
                address(bob).balance, initialBalance + 10 ether, "Should allow transfer that exactly reaches limit"
            );
        }

        // Test 5: Final tiny transfer (should fail - exceeds limit)
        {
            bytes memory calls = _createEthTransferCall(bob, 0.1 ether);

            (uint96 nonce96, bytes memory cipher) = acc.encrypt(calls);
            bytes memory signature = _signExecuteDigest(0, cipher);

            vm.prank(relayer);
            vm.expectRevert("spend limit exceeded");
            acc.execute(nonce96, cipher, signature, 0);

            assertEq(address(bob).balance, initialBalance + 10 ether, "No more transfers should be possible");
        }
    }
}
