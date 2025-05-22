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
    address constant RELAY_ADDRESS = address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC);

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

    /// @notice Creates and signs a digest for the execute function
    /// @param sessionIndex Index of the session to uses
    /// @param cipher Encrypted data to be executed
    /// @return signature The signature bytes
    function _signExecuteDigest(address account, uint32 sessionIndex, bytes memory cipher)
        internal
        view
        returns (bytes memory signature)
    {
        uint256 sessionNonce = ShieldedDelegationAccount(account).getSessionNonce(sessionIndex);
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
            abi.encodeWithSelector(SRC20.transfer.selector, address(recipient), suint256(amount));

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
    function _executeViaSession(address account, uint32 sessionIndex, bytes memory calls) internal {
        // Encrypt the calls
        (uint96 nonce, bytes memory cipher) = ShieldedDelegationAccount(account).encrypt(calls);

        // Sign the execution request
        bytes memory signature = _signExecuteDigest(account, sessionIndex, cipher);

        // Execute via relayer
        vm.prank(RELAY_ADDRESS);
        ShieldedDelegationAccount(account).execute(nonce, cipher, signature, sessionIndex);
    }

    function _signAndAttachDelegation(address implementation) internal {
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(implementation, ALICE_PK);
        vm.broadcast(RELAY_PK);
        vm.attachDelegation(signedDelegation);
        vm.stopBroadcast();
    }

    ////////////////////////////////////////////////////////////////////////
    // Test Cases
    ////////////////////////////////////////////////////////////////////////

    function test_signDelegationAndThenAttachDelegation() public {
        Vm.SignedDelegation memory signedDelegation = vm.signDelegation(address(acc), ALICE_PK);

        // Relay attaches the signed delegation from Alice and signs it
        vm.broadcast(RELAY_PK);
        vm.attachDelegation(signedDelegation);

        // Verify that Alice's account now behaves as a smart contract.
        bytes memory code = address(ALICE_ADDRESS).code;
        require(code.length > 0, "no code written to Alice");
    }

    /// @notice Test granting a session with expiry and limit
    function test_grantSession() public {
        // Grant a session that expires in 24 hours with 1 ETH limit
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(SKaddr, block.timestamp + 24 hours, 1 ether);

        // Access the session data from storage
        (address signer, uint256 expiry, uint256 limitWei, uint256 spentWei, uint256 nonce) =
            ShieldedDelegationAccount(ALICE_ADDRESS).sessions(0);

        // Verify all fields
        assertEq(signer, SKaddr, "Session signer should match");
        assertEq(expiry, block.timestamp + 24 hours, "Expiry should match");
        assertEq(limitWei, 1 ether, "Limit should match");
        assertEq(spentWei, 0, "Spent amount should be zero initially");
        assertEq(nonce, 0, "Nonce should be zero initially");
    }

    /// @notice Test granting and revoking multiple sessions
    function test_grantAndRevokeMultipleSessions() public {
        address signer1 = vm.addr(0xA1);
        address signer2 = vm.addr(0xA2);
        address signer3 = vm.addr(0xA3);

        // 1. Grant 3 sessions
        vm.startPrank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(signer1, block.timestamp + 1 hours, 1 ether);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(signer2, block.timestamp + 2 hours, 1 ether);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(signer3, block.timestamp + 3 hours, 1 ether);
        vm.stopPrank();

        // Verify signerToSessionIndex
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).getSessionIndex(signer1), 0);
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).getSessionIndex(signer2), 1);
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).getSessionIndex(signer3), 2);

        // 2. Revoke signer2
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeSession(signer2);

        // signer3 should have taken signer2's place
        uint32 newIndexForSigner3 = ShieldedDelegationAccount(ALICE_ADDRESS).getSessionIndex(signer3);
        assertEq(newIndexForSigner3, 1, "signer3 should now be at index 1");

        // // signer2 mapping should be removed
        vm.expectRevert("invalid signer mapping");
        ShieldedDelegationAccount(ALICE_ADDRESS).getSessionIndex(signer2);

        // Confirm session count shrinks
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).sessionCount(), 2, "Should have 2 active sessions");

        // Revoke signer1
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeSession(signer1);
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).sessionCount(), 1, "Should have 1 active session");

        // Revoke signer3
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeSession(signer3);
        assertEq(ShieldedDelegationAccount(ALICE_ADDRESS).sessionCount(), 0, "Should have 0 active sessions");
    }

    function test_revokeSessionWhenOnlyOneSessionExists() public {
        address signer1 = vm.addr(0xA1);
        address signer2 = vm.addr(0xA2);
        vm.startPrank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(signer1, block.timestamp + 24 hours, 1 ether);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(signer2, block.timestamp + 24 hours, 1 ether);
        vm.stopPrank();

        // Revoke signer2
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeSession(signer2);

        // Again try to revoke signer2 but this time it should revert
        vm.prank(ALICE_ADDRESS);
        vm.expectRevert("invalid signer mapping");
        ShieldedDelegationAccount(ALICE_ADDRESS).revokeSession(signer2);
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

    /// @notice Test executing a token transfer as the owner bypassing session key and signature checks
    function test_executeAsOwner() public {
        // Grant a session
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(SKaddr, block.timestamp + 24 hours, 1 ether);

        // Create the token transfer call
        bytes memory calls = _createTokenTransferCall(BOB_ADDRESS, 5 * 10 ** 18);

        // Encrypt and verify decryption works properly
        (uint96 encryptedCallsNonce, bytes memory encryptedCalls) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);
        // bytes memory decrypted = _decrypt(encryptedCallsNonce, encryptedCalls);
        // assertEq(decrypted, calls, "Decrypted calls should match original");

        // Execute the transaction as the owner
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).execute(encryptedCallsNonce, encryptedCalls, bytes(""), 0);

        // Verify Bob received the tokens
        vm.prank(BOB_ADDRESS);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 5 * 10 ** 18, "Bob should have received 5 tokens");
    }

    function test_execute() public {
        // Grant a session
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(SKaddr, block.timestamp + 24 hours, 1 ether);

        // Create the token transfer call
        bytes memory calls = _createTokenTransferCall(BOB_ADDRESS, 5 * 10 ** 18);

        // Encrypt and verify decryption works properly
        (uint96 encryptedCallsNonce, bytes memory encryptedCalls) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

        // Get session index for signing
        uint32 sessionIndex = ShieldedDelegationAccount(ALICE_ADDRESS).getSessionIndex(SKaddr);

        // Get session nonce for signing
        uint256 sessionNonce = ShieldedDelegationAccount(ALICE_ADDRESS).getSessionNonce(sessionIndex);

        // Generate domain separator
        bytes32 DOMAIN_SEPARATOR = _getDomainSeparator();

        // Create and sign digest
        bytes32 structHash = keccak256(abi.encode(EXECUTE_TYPEHASH, sessionNonce, keccak256(encryptedCalls)));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SK, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Execute the transaction
        vm.prank(RELAY_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).execute(encryptedCallsNonce, encryptedCalls, signature, sessionIndex);

        // Verify Bob received the tokens
        vm.prank(BOB_ADDRESS);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 5 * 10 ** 18, "Bob should have received 5 tokens");
    }

    /// @notice Test that execution is rejected when session has expired
    function test_revertWhenSessionExpired() public {
        // Grant a session
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(SKaddr, block.timestamp + 24 hours, 1 ether);

        // Advance time past expiration
        vm.warp(block.timestamp + 24 hours + 1 hours);

        // Create token transfer call
        bytes memory calls = _createTokenTransferCall(BOB_ADDRESS, 5 * 10 ** 18);

        // Encrypt the call data
        (uint96 encryptedCallsNonce, bytes memory encryptedCalls) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

        // Get session index for signing
        uint32 sessionIndex = ShieldedDelegationAccount(ALICE_ADDRESS).getSessionIndex(SKaddr);

        // Sign the execution request
        bytes memory signature = _signExecuteDigest(ALICE_ADDRESS, sessionIndex, encryptedCalls);

        // Execution should revert due to expired session
        vm.prank(RELAY_ADDRESS);
        vm.expectRevert("expired");
        ShieldedDelegationAccount(ALICE_ADDRESS).execute(encryptedCallsNonce, encryptedCalls, signature, sessionIndex);

        // Verify Bob didn't receive any tokens
        vm.prank(BOB_ADDRESS);
        uint256 bobBalance = tok.balanceOf();
        assertEq(bobBalance, 0, "Bob should not have received any tokens");
    }

    /// @notice Test that the session spending limit is enforced
    function test_ethSessionLimit() public {

        // Grant session with 10 ETH limit
        vm.prank(ALICE_ADDRESS);
        ShieldedDelegationAccount(ALICE_ADDRESS).grantSession(SKaddr, block.timestamp + 24 hours, 10 ether);

        // Record Bob's initial balance
        uint256 initialBalance = BOB_ADDRESS.balance;

        // Test 1: First transfer of 6 ETH (should succeed)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 6 ether);
            _executeViaSession(ALICE_ADDRESS, 0, calls);
            assertEq(BOB_ADDRESS.balance, initialBalance + 6 ether, "First transfer should succeed");
        }

        // Test 2: Second transfer of 3 ETH (should succeed)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 3 ether);
            _executeViaSession(ALICE_ADDRESS, 0, calls);
            assertEq(BOB_ADDRESS.balance, initialBalance + 9 ether, "Second transfer should succeed");
        }

        // Test 3: Third transfer of 2 ETH (should fail - would exceed limit)
        {
            bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 2 ether);

            (uint96 nonce96, bytes memory cipher) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

            // Get session index for signing
            uint32 sessionIndex = ShieldedDelegationAccount(ALICE_ADDRESS).getSessionIndex(SKaddr);

            // Sign the execution request
            bytes memory signature = _signExecuteDigest(ALICE_ADDRESS, sessionIndex, cipher);

            vm.prank(RELAY_ADDRESS);
            vm.expectRevert("spend limit exceeded");
            ShieldedDelegationAccount(ALICE_ADDRESS).execute(nonce96, cipher, signature, sessionIndex);

            assertEq(BOB_ADDRESS.balance, initialBalance + 9 ether, "Balance should not change after failed transfer");
        }

    //     // Test 4: Small transfer of 1 ETH (should succeed - exactly reaches limit)
    //     {
    //         bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 1 ether);
    //         _executeViaSession(ALICE_ADDRESS, 0, calls);
    //         assertEq(
    //             BOB_ADDRESS.balance, initialBalance + 10 ether, "Should allow transfer that exactly reaches limit"
    //         );
    //     }

    //     // Test 5: Final tiny transfer (should fail - exceeds limit)
    //     {
    //         bytes memory calls = _createEthTransferCall(BOB_ADDRESS, 0.1 ether);

    //         (uint96 nonce96, bytes memory cipher) = ShieldedDelegationAccount(ALICE_ADDRESS).encrypt(calls);

    //         // Get session index for signing
    //         uint32 sessionIndex = ShieldedDelegationAccount(ALICE_ADDRESS).getSessionIndex(SKaddr);

    //         // Sign the execution request
    //         bytes memory signature = _signExecuteDigest(ALICE_ADDRESS, sessionIndex, cipher);

    //         vm.prank(RELAY_ADDRESS);
    //         vm.expectRevert("spend limit exceeded");
    //         ShieldedDelegationAccount(ALICE_ADDRESS).execute(nonce96, cipher, signature, sessionIndex);

    //         assertEq(BOB_ADDRESS.balance, initialBalance + 10 ether, "No more transfers should be possible");
    //     }
    // }
}
}
